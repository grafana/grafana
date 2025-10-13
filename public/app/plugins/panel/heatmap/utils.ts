import { RefObject } from 'react';
import uPlot, { Cursor } from 'uplot';

import {
  DataFrameType,
  formattedValueToString,
  getValueFormat,
  GrafanaTheme2,
  incrRoundDn,
  incrRoundUp,
  TimeRange,
  FieldType,
} from '@grafana/data';
import { AxisPlacement, ScaleDirection, ScaleDistribution, ScaleOrientation, HeatmapCellLayout } from '@grafana/schema';
import { UPlotConfigBuilder } from '@grafana/ui';
import { isHeatmapCellsDense, readHeatmapRowsCustomMeta } from 'app/features/transformers/calculateHeatmap/heatmap';

import { pointWithin, Quadtree, Rect } from '../barchart/quadtree';

import { HeatmapData } from './fields';
import { FieldConfig, HeatmapSelectionMode, YAxisConfig } from './types';

interface PathbuilderOpts {
  each: (u: uPlot, seriesIdx: number, dataIdx: number, lft: number, top: number, wid: number, hgt: number) => void;
  gap?: number | null;
  hideLE?: number;
  hideGE?: number;
  xAlign?: -1 | 0 | 1;
  yAlign?: -1 | 0 | 1;
  ySizeDivisor?: number;
  disp: {
    fill: {
      values: (u: uPlot, seriesIndex: number) => number[];
      index: Array<CanvasRenderingContext2D['fillStyle']>;
    };
  };
}

interface PointsBuilderOpts {
  each: (u: uPlot, seriesIdx: number, dataIdx: number, lft: number, top: number, wid: number, hgt: number) => void;
}

interface PrepConfigOpts {
  dataRef: RefObject<HeatmapData>;
  theme: GrafanaTheme2;
  timeZone: string;
  getTimeRange: () => TimeRange;
  exemplarColor: string;
  cellGap?: number | null; // in css pixels
  hideLE?: number;
  hideGE?: number;
  yAxisConfig: YAxisConfig;
  ySizeDivisor?: number;
  selectionMode?: HeatmapSelectionMode;
}

export function prepConfig(opts: PrepConfigOpts) {
  const {
    dataRef,
    theme,
    timeZone,
    getTimeRange,
    cellGap,
    hideLE,
    hideGE,
    yAxisConfig,
    ySizeDivisor,
    selectionMode = HeatmapSelectionMode.X,
  } = opts;

  const xScaleKey = 'x';
  let isTime = true;

  if (dataRef.current?.heatmap?.fields[0].type !== FieldType.time) {
    isTime = false;
  }

  const pxRatio = devicePixelRatio;

  let heatmapType = dataRef.current?.heatmap?.meta?.type;
  const exemplarFillColor = theme.visualization.getColorByName(opts.exemplarColor);

  let qt: Quadtree;
  let hRect: Rect | null;

  let builder = new UPlotConfigBuilder(timeZone);

  builder.addHook('init', (u) => {
    u.root.querySelectorAll<HTMLElement>('.u-cursor-pt').forEach((el) => {
      Object.assign(el.style, {
        borderRadius: '0',
        border: '1px solid white',
        background: 'transparent',
      });
    });
  });

  if (isTime) {
    // this is a tmp hack because in mode: 2, uplot does not currently call scales.x.range() for setData() calls
    // scales.x.range() typically reads back from drilled-down panelProps.timeRange via getTimeRange()
    builder.addHook('setData', (u) => {
      //let [min, max] = (u.scales!.x!.range! as uPlot.Range.Function)(u, 0, 100, xScaleKey);

      let { min: xMin, max: xMax } = u.scales!.x;

      let min = getTimeRange().from.valueOf();
      let max = getTimeRange().to.valueOf();

      if (xMin !== min || xMax !== max) {
        queueMicrotask(() => {
          u.setScale(xScaleKey, { min, max });
        });
      }
    });
  }

  builder.addHook('drawClear', (u) => {
    qt = qt || new Quadtree(0, 0, u.bbox.width, u.bbox.height);

    qt.clear();

    // force-clear the path cache to cause drawBars() to rebuild new quadtree
    u.series.forEach((s, i) => {
      if (i > 0) {
        // @ts-ignore
        s._paths = null;
      }
    });
  });

  builder.setMode(2);

  builder.addScale({
    scaleKey: xScaleKey,
    isTime,
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
    // TODO: expand by x bucket size and layout
    range: (u, dataMin, dataMax) => {
      if (isTime) {
        return [getTimeRange().from.valueOf(), getTimeRange().to.valueOf()];
      } else {
        if (dataRef.current?.xLayout === HeatmapCellLayout.le) {
          return [dataMin - dataRef.current?.xBucketSize!, dataMax];
        } else if (dataRef.current?.xLayout === HeatmapCellLayout.ge) {
          return [dataMin, dataMax + dataRef.current?.xBucketSize!];
        } else {
          let offset = dataRef.current?.xBucketSize! / 2;

          return [dataMin - offset, dataMax + offset];
        }
      }
    },
  });

  let incrs;

  if (!isTime) {
    incrs = [];

    for (let i = 0; i < 10; i++) {
      incrs.push(i * dataRef.current?.xBucketSize!);
    }
  }

  builder.addAxis({
    scaleKey: xScaleKey,
    placement: AxisPlacement.Bottom,
    incrs,
    isTime,
    theme: theme,
    timeZone,
  });

  const yField = dataRef.current?.heatmap?.fields[1]!;
  if (!yField) {
    return builder; // early abort (avoids error)
  }

  const yFieldConfig: FieldConfig | undefined = yField.config?.custom;
  const yScale = yFieldConfig?.scaleDistribution ?? { type: ScaleDistribution.Linear };
  const yAxisReverse = Boolean(yAxisConfig.reverse);
  const isSparseHeatmap = heatmapType === DataFrameType.HeatmapCells && !isHeatmapCellsDense(dataRef.current?.heatmap!);
  const shouldUseLogScale = yScale.type !== ScaleDistribution.Linear || isSparseHeatmap;
  const isOrdinalY = readHeatmapRowsCustomMeta(dataRef.current?.heatmap).yOrdinalDisplay != null;

  // random to prevent syncing y in other heatmaps
  // TODO: try to match TimeSeries y keygen algo to sync with TimeSeries panels (when not isOrdinalY)
  const yScaleKey = 'y_' + (Math.random() + 1).toString(36).substring(7);

  builder.addScale({
    scaleKey: yScaleKey,
    isTime: false,
    // distribution: ScaleDistribution.Ordinal, // does not work with facets/scatter yet
    orientation: ScaleOrientation.Vertical,
    direction: yAxisReverse ? ScaleDirection.Down : ScaleDirection.Up,
    // should be tweakable manually
    distribution: shouldUseLogScale ? ScaleDistribution.Log : ScaleDistribution.Linear,
    log: yScale.log ?? 2,
    range:
      // sparse already accounts for le/ge by explicit yMin & yMax cell bounds, so no need to expand y range
      isSparseHeatmap
        ? (u, dataMin, dataMax) => {
            // ...but uPlot currently only auto-ranges from the yMin facet data, so we have to grow by 1 extra factor
            // @ts-ignore
            let bucketFactor = u.data[1][2][0] / u.data[1][1][0];

            dataMax *= bucketFactor;

            let scaleMin: number | null, scaleMax: number | null;

            [scaleMin, scaleMax] = shouldUseLogScale
              ? uPlot.rangeLog(dataMin, dataMax, (yScale.log ?? 2) as unknown as uPlot.Scale.LogBase, true)
              : [dataMin, dataMax];

            if (shouldUseLogScale && !isOrdinalY) {
              let yExp = u.scales[yScaleKey].log!;
              let log = yExp === 2 ? Math.log2 : Math.log10;

              let { min: explicitMin, max: explicitMax } = yAxisConfig;

              // guard against <= 0
              if (explicitMin != null && explicitMin > 0) {
                // snap to magnitude
                let minLog = log(explicitMin);
                scaleMin = yExp ** incrRoundDn(minLog, 1);
              }

              if (explicitMax != null && explicitMax > 0) {
                let maxLog = log(explicitMax);
                scaleMax = yExp ** incrRoundUp(maxLog, 1);
              }
            }

            return [scaleMin, scaleMax];
          }
        : // dense and ordinal only have one of yMin|yMax|y, so expand range by one cell in the direction of le/ge/unknown
          (u, dataMin, dataMax) => {
            let scaleMin = dataMin,
              scaleMax = dataMax;

            let { min: explicitMin, max: explicitMax } = yAxisConfig;

            // logarithmic expansion
            if (shouldUseLogScale) {
              let yExp = u.scales[yScaleKey].log!;

              let minExpanded = false;
              let maxExpanded = false;

              let log = yExp === 2 ? Math.log2 : Math.log10;

              if (ySizeDivisor !== 1) {
                let minLog = log(dataMin);
                let maxLog = log(dataMax);

                if (!Number.isInteger(minLog)) {
                  scaleMin = yExp ** incrRoundDn(minLog, 1);
                  minExpanded = true;
                }

                if (!Number.isInteger(maxLog)) {
                  scaleMax = yExp ** incrRoundUp(maxLog, 1);
                  maxExpanded = true;
                }
              }

              if (dataRef.current?.yLayout === HeatmapCellLayout.le) {
                if (!minExpanded) {
                  scaleMin /= yExp;
                }
              } else if (dataRef.current?.yLayout === HeatmapCellLayout.ge) {
                if (!maxExpanded) {
                  scaleMax *= yExp;
                }
              } else {
                scaleMin /= yExp / 2;
                scaleMax *= yExp / 2;
              }

              if (!isOrdinalY) {
                // guard against <= 0
                if (explicitMin != null && explicitMin > 0) {
                  // snap down to magnitude
                  let minLog = log(explicitMin);
                  scaleMin = yExp ** incrRoundDn(minLog, 1);
                }

                if (explicitMax != null && explicitMax > 0) {
                  let maxLog = log(explicitMax);
                  scaleMax = yExp ** incrRoundUp(maxLog, 1);
                }
              }
            }
            // linear expansion
            else {
              let bucketSize = dataRef.current?.yBucketSize;

              if (bucketSize === 0) {
                bucketSize = 1;
              }

              if (bucketSize) {
                if (dataRef.current?.yLayout === HeatmapCellLayout.le) {
                  scaleMin -= bucketSize!;
                } else if (dataRef.current?.yLayout === HeatmapCellLayout.ge) {
                  scaleMax += bucketSize!;
                } else {
                  scaleMin -= bucketSize! / 2;
                  scaleMax += bucketSize! / 2;
                }
              } else {
                // how to expand scale range if inferred non-regular or log buckets?
              }

              if (!isOrdinalY) {
                scaleMin = explicitMin ?? scaleMin;
                scaleMax = explicitMax ?? scaleMax;
              }
            }

            return [scaleMin, scaleMax];
          },
  });

  const dispY = yField.display ?? getValueFormat('short');

  builder.addAxis({
    scaleKey: yScaleKey,
    show: yAxisConfig.axisPlacement !== AxisPlacement.Hidden,
    placement: yAxisConfig.axisPlacement || AxisPlacement.Left,
    size: yAxisConfig.axisWidth || null,
    label: yAxisConfig.axisLabel,
    theme: theme,
    formatValue: (v, decimals) => formattedValueToString(dispY(v, decimals)),
    splits: isOrdinalY
      ? (self: uPlot) => {
          const meta = readHeatmapRowsCustomMeta(dataRef.current?.heatmap);
          if (!meta.yOrdinalDisplay) {
            return [0, 1]; //?
          }
          let splits = meta.yOrdinalDisplay.map((v, idx) => idx);

          switch (dataRef.current?.yLayout) {
            case HeatmapCellLayout.le:
              splits.unshift(-1);
              break;
            case HeatmapCellLayout.ge:
              splits.push(splits.length);
              break;
          }

          // Skip labels when the height is too small
          if (self.height < 60) {
            splits = [splits[0], splits[splits.length - 1]];
          } else {
            while (splits.length > 3 && (self.height - 15) / splits.length < 10) {
              splits = splits.filter((v, idx) => idx % 2 === 0); // remove half the items
            }
          }
          return splits;
        }
      : undefined,
    values: isOrdinalY
      ? (self: uPlot, splits) => {
          const meta = readHeatmapRowsCustomMeta(dataRef.current?.heatmap);
          if (meta.yOrdinalDisplay) {
            return splits.map((v) =>
              v < 0
                ? (meta.yMinDisplay ?? '') // Check prometheus style labels
                : (meta.yOrdinalDisplay[v] ?? '')
            );
          }
          return splits;
        }
      : undefined,
  });

  const pathBuilder = isSparseHeatmap ? heatmapPathsSparse : heatmapPathsDense;

  // heatmap layer
  builder.addSeries({
    facets: [
      {
        scale: xScaleKey,
        auto: true,
        sorted: 1,
      },
      {
        scale: yScaleKey,
        auto: true,
      },
    ],
    pathBuilder: pathBuilder({
      each: (u, seriesIdx, dataIdx, x, y, xSize, ySize) => {
        qt.add({
          x: x - u.bbox.left,
          y: y - u.bbox.top,
          w: xSize,
          h: ySize,
          sidx: seriesIdx,
          didx: dataIdx,
        });
      },
      gap: cellGap,
      hideLE,
      hideGE,
      xAlign:
        dataRef.current?.xLayout === HeatmapCellLayout.le
          ? -1
          : dataRef.current?.xLayout === HeatmapCellLayout.ge
            ? 1
            : 0,
      yAlign: ((dataRef.current?.yLayout === HeatmapCellLayout.le
        ? -1
        : dataRef.current?.yLayout === HeatmapCellLayout.ge
          ? 1
          : 0) * (yAxisReverse ? -1 : 1)) as -1 | 0 | 1,
      ySizeDivisor,
      disp: {
        fill: {
          values: (u, seriesIdx) => dataRef.current?.heatmapColors?.values!,
          index: dataRef.current?.heatmapColors?.palette!,
        },
      },
    }),
    theme,
    scaleKey: '', // facets' scales used (above)
  });

  // exemplars layer
  builder.addSeries({
    facets: [
      {
        scale: xScaleKey,
        auto: true,
        sorted: 1,
      },
      {
        scale: yScaleKey,
        auto: true,
      },
    ],
    pathBuilder: heatmapPathsPoints(
      {
        each: (u, seriesIdx, dataIdx, x, y, xSize, ySize) => {
          qt.add({
            x: x - u.bbox.left,
            y: y - u.bbox.top,
            w: xSize,
            h: ySize,
            sidx: seriesIdx,
            didx: dataIdx,
          });
        },
      },
      exemplarFillColor,
      dataRef.current.yLayout
    ),
    theme,
    scaleKey: '', // facets' scales used (above)
  });

  const dragX = selectionMode === HeatmapSelectionMode.X || selectionMode === HeatmapSelectionMode.Xy;
  const dragY = selectionMode === HeatmapSelectionMode.Y || selectionMode === HeatmapSelectionMode.Xy;

  const cursor: Cursor = {
    drag: {
      x: dragX,
      y: dragY,
      setScale: false,
    },
    dataIdx: (u, seriesIdx) => {
      if (seriesIdx === 1) {
        hRect = null;

        let cx = u.cursor.left! * pxRatio;
        let cy = u.cursor.top! * pxRatio;

        qt.get(cx, cy, 1, 1, (o) => {
          if (pointWithin(cx, cy, o.x, o.y, o.x + o.w, o.y + o.h)) {
            hRect = o;
          }
        });
      }

      return hRect && seriesIdx === hRect.sidx ? hRect.didx : null;
    },
    focus: {
      prox: 1e3,
      dist: (u, seriesIdx) => (hRect?.sidx === seriesIdx ? 0 : Infinity),
    },
    points: {
      fill: 'rgba(255,255,255, 0.3)',
      bbox: (u, seriesIdx) => {
        let isHovered = hRect && seriesIdx === hRect.sidx;

        return {
          left: isHovered ? hRect!.x / pxRatio : -10,
          top: isHovered ? hRect!.y / pxRatio : -10,
          width: isHovered ? hRect!.w / pxRatio : 0,
          height: isHovered ? hRect!.h / pxRatio : 0,
        };
      },
    },
  };

  builder.setCursor(cursor);

  return builder;
}

const CRISP_EDGES_GAP_MIN = 4;

export function heatmapPathsDense(opts: PathbuilderOpts) {
  const { disp, each, gap = 1, hideLE = -Infinity, hideGE = Infinity, xAlign = 1, yAlign = 1, ySizeDivisor = 1 } = opts;

  const pxRatio = devicePixelRatio;

  const round = gap! >= CRISP_EDGES_GAP_MIN ? Math.round : (v: number) => v;

  const cellGap = Math.round(gap! * pxRatio);

  return (u: uPlot, seriesIdx: number) => {
    uPlot.orient(
      u,
      seriesIdx,
      (
        series,
        dataX,
        dataY,
        scaleX,
        scaleY,
        valToPosX,
        valToPosY,
        xOff,
        yOff,
        xDim,
        yDim,
        moveTo,
        lineTo,
        rect,
        arc
      ) => {
        let d = u.data[seriesIdx];
        const xs = d[0] as unknown as number[];
        const ys = d[1] as unknown as number[];
        const counts = d[2] as unknown as number[];
        const dlen = xs.length;

        // fill colors are mapped from interpolating densities / counts along some gradient
        // (should be quantized to 64 colors/levels max. e.g. 16)
        let fills = disp.fill.values(u, seriesIdx);
        let fillPalette = disp.fill.index ?? [...new Set(fills)];

        let fillPaths = fillPalette.map((color) => new Path2D());

        // detect x and y bin qtys by detecting layout repetition in x & y data
        let yBinQty = dlen - ys.lastIndexOf(ys[0]);
        let xBinQty = dlen / yBinQty;
        let yBinIncr = ys[1] - ys[0] || scaleY.max! - scaleY.min!;
        let xBinIncr = xs[yBinQty] - xs[0];

        // uniform tile sizes based on zoom level
        let xSize: number;
        let ySize: number;

        if (scaleX.distr === 3) {
          xSize = Math.abs(valToPosX(xs[0] * scaleX.log!, scaleX, xDim, xOff) - valToPosX(xs[0], scaleX, xDim, xOff));
        } else {
          xSize = Math.abs(valToPosX(xBinIncr, scaleX, xDim, xOff) - valToPosX(0, scaleX, xDim, xOff));
        }

        if (scaleY.distr === 3) {
          ySize =
            Math.abs(valToPosY(ys[0] * scaleY.log!, scaleY, yDim, yOff) - valToPosY(ys[0], scaleY, yDim, yOff)) /
            ySizeDivisor;
        } else {
          ySize = Math.abs(valToPosY(yBinIncr, scaleY, yDim, yOff) - valToPosY(0, scaleY, yDim, yOff)) / ySizeDivisor;
        }

        // clamp min tile size to 1px
        xSize = Math.max(1, round(xSize - cellGap));
        ySize = Math.max(1, round(ySize - cellGap));

        // bucket agg direction
        // let xCeil = false;
        // let yCeil = false;

        let xOffset = xAlign === -1 ? -xSize : xAlign === 0 ? -xSize / 2 : 0;
        let yOffset = yAlign === 1 ? -ySize : yAlign === 0 ? -ySize / 2 : 0;

        // pre-compute x and y offsets
        let cys = ys.slice(0, yBinQty).map((y) => round(valToPosY(y, scaleY, yDim, yOff) + yOffset));
        let cxs = Array.from({ length: xBinQty }, (v, i) =>
          round(valToPosX(xs[i * yBinQty], scaleX, xDim, xOff) + xOffset)
        );

        for (let i = 0; i < dlen; i++) {
          if (counts[i] != null && counts[i] > hideLE && counts[i] < hideGE) {
            let cx = cxs[~~(i / yBinQty)];
            let cy = cys[i % yBinQty];

            let fillPath = fillPaths[fills[i]];

            rect(fillPath, cx, cy, xSize, ySize);

            each(u, 1, i, cx, cy, xSize, ySize);
          }
        }

        u.ctx.save();
        //	u.ctx.globalAlpha = 0.8;
        u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
        u.ctx.clip();
        fillPaths.forEach((p, i) => {
          u.ctx.fillStyle = fillPalette[i];
          u.ctx.fill(p);
        });
        u.ctx.restore();

        return null;
      }
    );

    return null;
  };
}

export function heatmapPathsPoints(opts: PointsBuilderOpts, exemplarColor: string, yLayout?: HeatmapCellLayout) {
  return (u: uPlot, seriesIdx: number) => {
    uPlot.orient(
      u,
      seriesIdx,
      (
        series,
        dataX,
        dataY,
        scaleX,
        scaleY,
        valToPosX,
        valToPosY,
        xOff,
        yOff,
        xDim,
        yDim,
        moveTo,
        lineTo,
        rect,
        arc
      ) => {
        //console.time('heatmapPathsSparse');

        let points = new Path2D();
        let fillPaths = [points];
        let fillPalette = [exemplarColor ?? 'rgba(255,0,255,0.7)'];

        let yShift = yLayout === HeatmapCellLayout.le ? -0.5 : yLayout === HeatmapCellLayout.ge ? 0.5 : 0;

        for (let i = 0; i < dataX.length; i++) {
          let yVal = dataY[i]!;

          // this is a hacky by-proxy check
          // works okay since we have no exemplars in calculated heatmaps and...
          //  - heatmap-rows has ordinal y
          //  - heatmap-cells has log2 y
          let isSparseHeatmap = scaleY.distr === 3 && scaleY.log === 2;

          if (!isSparseHeatmap) {
            yVal += yShift;
          }

          let x = valToPosX(dataX[i], scaleX, xDim, xOff);
          let y = valToPosY(yVal, scaleY, yDim, yOff);
          let w = 8;
          let h = 8;

          rect(points, x - w / 2, y - h / 2, w, h);

          opts.each(u, seriesIdx, i, x - w / 2, y - h / 2, w, h);
        }

        u.ctx.save();
        u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
        u.ctx.clip();
        fillPaths.forEach((p, i) => {
          u.ctx.fillStyle = fillPalette[i];
          u.ctx.fill(p);
        });
        u.ctx.restore();
      }
    );

    return null;
  };
}
// accepts xMax, yMin, yMax, count
// xbinsize? x tile sizes are uniform?
export function heatmapPathsSparse(opts: PathbuilderOpts) {
  const { disp, each, gap = 1, hideLE = -Infinity, hideGE = Infinity } = opts;

  const pxRatio = devicePixelRatio;

  const round = gap! >= CRISP_EDGES_GAP_MIN ? Math.round : (v: number) => v;

  const cellGap = Math.round(gap! * pxRatio);

  return (u: uPlot, seriesIdx: number) => {
    uPlot.orient(
      u,
      seriesIdx,
      (
        series,
        dataX,
        dataY,
        scaleX,
        scaleY,
        valToPosX,
        valToPosY,
        xOff,
        yOff,
        xDim,
        yDim,
        moveTo,
        lineTo,
        rect,
        arc
      ) => {
        //console.time('heatmapPathsSparse');

        let d = u.data[seriesIdx];
        const xMaxs = d[0] as unknown as number[]; // xMax, do we get interval?
        const yMins = d[1] as unknown as number[];
        const yMaxs = d[2] as unknown as number[];
        const counts = d[3] as unknown as number[];
        const dlen = xMaxs.length;

        // fill colors are mapped from interpolating densities / counts along some gradient
        // (should be quantized to 64 colors/levels max. e.g. 16)
        let fills = disp.fill.values(u, seriesIdx);
        let fillPalette = disp.fill.index ?? [...new Set(fills)];

        let fillPaths = fillPalette.map((color) => new Path2D());

        // cache all tile bounds
        let xOffs = new Map();
        let yOffs = new Map();

        for (let i = 0; i < xMaxs.length; i++) {
          let xMax = xMaxs[i];
          let yMin = yMins[i];
          let yMax = yMaxs[i];

          if (!xOffs.has(xMax)) {
            xOffs.set(xMax, round(valToPosX(xMax, scaleX, xDim, xOff)));
          }

          if (!yOffs.has(yMin)) {
            yOffs.set(yMin, round(valToPosY(yMin, scaleY, yDim, yOff)));
          }

          if (!yOffs.has(yMax)) {
            yOffs.set(yMax, round(valToPosY(yMax, scaleY, yDim, yOff)));
          }
        }

        // uniform x size (interval, step)
        let xSizeUniform = xOffs.get(xMaxs.find((v) => v !== xMaxs[0])) - xOffs.get(xMaxs[0]);

        for (let i = 0; i < dlen; i++) {
          if (counts[i] <= hideLE || counts[i] >= hideGE) {
            continue;
          }

          let xMax = xMaxs[i];
          let yMin = yMins[i];
          let yMax = yMaxs[i];

          let xMaxPx = xOffs.get(xMax); // xSize is from interval, or inferred delta?
          let yMinPx = yOffs.get(yMin);
          let yMaxPx = yOffs.get(yMax);

          let xSize = xSizeUniform;
          let ySize = yMinPx - yMaxPx;

          // clamp min tile size to 1px
          xSize = Math.max(1, xSize - cellGap);
          ySize = Math.max(1, ySize - cellGap);

          let x = xMaxPx - cellGap / 2 - xSize;
          let y = yMaxPx + cellGap / 2;

          let fillPath = fillPaths[fills[i]];

          rect(fillPath, x, y, xSize, ySize);

          each(u, 1, i, x, y, xSize, ySize);
        }

        u.ctx.save();
        //	u.ctx.globalAlpha = 0.8;
        u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
        u.ctx.clip();
        fillPaths.forEach((p, i) => {
          u.ctx.fillStyle = fillPalette[i];
          u.ctx.fill(p);
        });
        u.ctx.restore();

        //console.timeEnd('heatmapPathsSparse');
      }
    );

    return null;
  };
}

export const boundedMinMax = (
  values: number[],
  minValue?: number,
  maxValue?: number,
  hideLE = -Infinity,
  hideGE = Infinity
) => {
  if (minValue == null) {
    minValue = Infinity;

    for (let i = 0; i < values.length; i++) {
      if (values[i] != null && values[i] > hideLE && values[i] < hideGE) {
        minValue = Math.min(minValue, values[i]);
      }
    }
  }

  if (maxValue == null) {
    maxValue = -Infinity;

    for (let i = 0; i < values.length; i++) {
      if (values[i] != null && values[i] > hideLE && values[i] < hideGE) {
        maxValue = Math.max(maxValue, values[i]);
      }
    }
  }

  return [minValue, maxValue];
};

export const valuesToFills = (values: number[], palette: string[], minValue: number, maxValue: number): number[] => {
  let range = maxValue - minValue || 1;

  let paletteSize = palette.length;

  let indexedFills = Array(values.length);

  for (let i = 0; i < values.length; i++) {
    indexedFills[i] =
      values[i] < minValue
        ? 0
        : values[i] > maxValue
          ? paletteSize - 1
          : Math.min(paletteSize - 1, Math.floor((paletteSize * (values[i] - minValue)) / range));
  }

  return indexedFills;
};
