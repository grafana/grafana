import { MutableRefObject, RefObject } from 'react';
import uPlot from 'uplot';

import { DataFrameType, GrafanaTheme2, TimeRange } from '@grafana/data';
import { AxisPlacement, ScaleDirection, ScaleDistribution, ScaleOrientation } from '@grafana/schema';
import { UPlotConfigBuilder } from '@grafana/ui';

import { pointWithin, Quadtree, Rect } from '../barchart/quadtree';

import { BucketLayout, HeatmapData } from './fields';

interface PathbuilderOpts {
  each: (u: uPlot, seriesIdx: number, dataIdx: number, lft: number, top: number, wid: number, hgt: number) => void;
  gap?: number | null;
  hideThreshold?: number;
  xAlign?: -1 | 0 | 1;
  yAlign?: -1 | 0 | 1;
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

export interface HeatmapHoverEvent {
  seriesIdx: number;
  dataIdx: number;
  pageX: number;
  pageY: number;
}

export interface HeatmapZoomEvent {
  xMin: number;
  xMax: number;
}

interface PrepConfigOpts {
  dataRef: RefObject<HeatmapData>;
  theme: GrafanaTheme2;
  onhover?: null | ((evt?: HeatmapHoverEvent | null) => void);
  onclick?: null | ((evt?: any) => void);
  onzoom?: null | ((evt: HeatmapZoomEvent) => void);
  isToolTipOpen: MutableRefObject<boolean>;
  timeZone: string;
  getTimeRange: () => TimeRange;
  palette: string[];
  exemplarColor: string;
  cellGap?: number | null; // in css pixels
  hideThreshold?: number;
}

export function prepConfig(opts: PrepConfigOpts) {
  const {
    dataRef,
    theme,
    onhover,
    onclick,
    onzoom,
    isToolTipOpen,
    timeZone,
    getTimeRange,
    palette,
    cellGap,
    hideThreshold,
  } = opts;

  const pxRatio = devicePixelRatio;

  let heatmapType = dataRef.current?.heatmap?.meta?.type;
  const exemplarFillColor = theme.visualization.getColorByName(opts.exemplarColor);

  let qt: Quadtree;
  let hRect: Rect | null;

  let builder = new UPlotConfigBuilder(timeZone);

  let rect: DOMRect;

  builder.addHook('init', (u) => {
    u.root.querySelectorAll('.u-cursor-pt').forEach((el) => {
      Object.assign((el as HTMLElement).style, {
        borderRadius: '0',
        border: '1px solid white',
        background: 'transparent',
      });
    });

    onclick &&
      u.over.addEventListener(
        'mouseup',
        (e) => {
          // @ts-ignore
          let isDragging: boolean = u.cursor.drag._x || u.cursor.drag._y;

          if (!isDragging) {
            onclick(e);
          }
        },
        true
      );
  });

  onzoom &&
    builder.addHook('setSelect', (u) => {
      onzoom({
        xMin: u.posToVal(u.select.left, 'x'),
        xMax: u.posToVal(u.select.left + u.select.width, 'x'),
      });
      u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
    });

  // this is a tmp hack because in mode: 2, uplot does not currently call scales.x.range() for setData() calls
  // scales.x.range() typically reads back from drilled-down panelProps.timeRange via getTimeRange()
  builder.addHook('setData', (u) => {
    //let [min, max] = (u.scales!.x!.range! as uPlot.Range.Function)(u, 0, 100, 'x');

    let { min: xMin, max: xMax } = u.scales!.x;

    let min = getTimeRange().from.valueOf();
    let max = getTimeRange().to.valueOf();

    if (xMin !== min || xMax !== max) {
      queueMicrotask(() => {
        u.setScale('x', { min, max });
      });
    }
  });

  // rect of .u-over (grid area)
  builder.addHook('syncRect', (u, r) => {
    rect = r;
  });

  let pendingOnleave = 0;

  onhover &&
    builder.addHook('setLegend', (u) => {
      if (u.cursor.idxs != null) {
        for (let i = 0; i < u.cursor.idxs.length; i++) {
          const sel = u.cursor.idxs[i];
          if (sel != null && !isToolTipOpen.current) {
            if (pendingOnleave) {
              clearTimeout(pendingOnleave);
              pendingOnleave = 0;
            }

            onhover({
              seriesIdx: i,
              dataIdx: sel,
              pageX: rect.left + u.cursor.left!,
              pageY: rect.top + u.cursor.top!,
            });

            return; // only show the first one
          }
        }
      }

      if (!isToolTipOpen.current) {
        // if tiles have gaps, reduce flashing / re-render (debounce onleave by 100ms)
        if (!pendingOnleave) {
          pendingOnleave = setTimeout(() => onhover(null), 100) as any;
        }
      }
    });

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
    scaleKey: 'x',
    isTime: true,
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
    // TODO: expand by x bucket size and layout
    range: () => {
      return [getTimeRange().from.valueOf(), getTimeRange().to.valueOf()];
    },
  });

  builder.addAxis({
    scaleKey: 'x',
    placement: AxisPlacement.Bottom,
    isTime: true,
    theme: theme,
  });

  const shouldUseLogScale = heatmapType === DataFrameType.HeatmapSparse;

  builder.addScale({
    scaleKey: 'y',
    isTime: false,
    // distribution: ScaleDistribution.Ordinal, // does not work with facets/scatter yet
    orientation: ScaleOrientation.Vertical,
    direction: ScaleDirection.Up,
    // should be tweakable manually
    distribution: shouldUseLogScale ? ScaleDistribution.Log : ScaleDistribution.Linear,
    log: 2,
    range: shouldUseLogScale
      ? undefined
      : (u, dataMin, dataMax) => {
          const bucketSize = dataRef.current?.yBucketSize;

          if (bucketSize) {
            if (dataRef.current?.yLayout === BucketLayout.le) {
              dataMin -= bucketSize!;
            } else if (dataRef.current?.yLayout === BucketLayout.ge) {
              dataMax += bucketSize!;
            } else {
              dataMin -= bucketSize! / 2;
              dataMax += bucketSize! / 2;
            }
          } else {
            // how to expand scale range if inferred non-regular or log buckets?
          }

          return [dataMin, dataMax];
        },
  });

  const hasLabeledY = dataRef.current?.yAxisValues != null;

  builder.addAxis({
    scaleKey: 'y',
    placement: AxisPlacement.Left,
    theme: theme,
    splits: hasLabeledY
      ? () => {
          const ys = dataRef.current?.heatmap?.fields[1].values.toArray()!;
          const splits = ys.slice(0, ys.length - ys.lastIndexOf(ys[0]));

          const bucketSize = dataRef.current?.yBucketSize!;

          if (dataRef.current?.yLayout === BucketLayout.le) {
            splits.unshift(ys[0] - bucketSize);
          } else {
            splits.push(ys[ys.length - 1] + bucketSize);
          }

          return splits;
        }
      : undefined,
    values: hasLabeledY
      ? () => {
          const yAxisValues = dataRef.current?.yAxisValues?.slice()!;

          if (dataRef.current?.yLayout === BucketLayout.le) {
            yAxisValues.unshift('0.0'); // assumes dense layout where lowest bucket's low bound is 0-ish
          } else if (dataRef.current?.yLayout === BucketLayout.ge) {
            yAxisValues.push('+Inf');
          }

          return yAxisValues;
        }
      : undefined,
  });

  const pathBuilder = heatmapType === DataFrameType.HeatmapScanlines ? heatmapPathsDense : heatmapPathsSparse;

  // heatmap layer
  builder.addSeries({
    facets: [
      {
        scale: 'x',
        auto: true,
        sorted: 1,
      },
      {
        scale: 'y',
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
      hideThreshold,
      xAlign: dataRef.current?.xLayout === BucketLayout.le ? -1 : dataRef.current?.xLayout === BucketLayout.ge ? 1 : 0,
      yAlign: dataRef.current?.yLayout === BucketLayout.le ? -1 : dataRef.current?.yLayout === BucketLayout.ge ? 1 : 0,
      disp: {
        fill: {
          values: (u, seriesIdx) => {
            let countFacetIdx = heatmapType === DataFrameType.HeatmapScanlines ? 2 : 3;
            return countsToFills(u.data[seriesIdx][countFacetIdx] as unknown as number[], palette);
          },
          index: palette,
        },
      },
    }) as any,
    theme,
    scaleKey: '', // facets' scales used (above)
  });

  // exemplars layer
  builder.addSeries({
    facets: [
      {
        scale: 'x',
        auto: true,
        sorted: 1,
      },
      {
        scale: 'y',
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
      exemplarFillColor
    ) as any,
    theme,
    scaleKey: '', // facets' scales used (above)
  });

  builder.setCursor({
    drag: {
      x: true,
      y: false,
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
  });

  return builder;
}

const CRISP_EDGES_GAP_MIN = 4;

export function heatmapPathsDense(opts: PathbuilderOpts) {
  const { disp, each, gap = 1, hideThreshold = 0, xAlign = 1, yAlign = 1 } = opts;

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
        let yBinIncr = ys[1] - ys[0];
        let xBinIncr = xs[yBinQty] - xs[0];

        // uniform tile sizes based on zoom level
        let xSize = Math.abs(valToPosX(xBinIncr, scaleX, xDim, xOff) - valToPosX(0, scaleX, xDim, xOff));
        let ySize = Math.abs(valToPosY(yBinIncr, scaleY, yDim, yOff) - valToPosY(0, scaleY, yDim, yOff));

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
          // filter out 0 counts and out of view
          if (
            counts[i] > hideThreshold &&
            xs[i] + xBinIncr >= scaleX.min! &&
            xs[i] - xBinIncr <= scaleX.max! &&
            ys[i] + yBinIncr >= scaleY.min! &&
            ys[i] - yBinIncr <= scaleY.max!
          ) {
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
  };
}

export function heatmapPathsPoints(opts: PointsBuilderOpts, exemplarColor: string) {
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

        [dataX, dataY] = dataY as unknown as number[][];

        let points = new Path2D();
        let fillPaths = [points];
        let fillPalette = [exemplarColor ?? 'rgba(255,0,255,0.7)'];

        for (let i = 0; i < dataX.length; i++) {
          let yVal = dataY[i]!;
          yVal -= 0.5; // center vertically in bucket (when tiles are le)
          // y-randomize vertically to distribute exemplars in same bucket at same time
          let randSign = Math.round(Math.random()) * 2 - 1;
          yVal += randSign * 0.5 * Math.random();

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
  };
}
// accepts xMax, yMin, yMax, count
// xbinsize? x tile sizes are uniform?
export function heatmapPathsSparse(opts: PathbuilderOpts) {
  const { disp, each, gap = 1, hideThreshold = 0 } = opts;

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
          if (counts[i] <= hideThreshold) {
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

          let x = xMaxPx;
          let y = yMinPx;

          // filter out 0 counts and out of view
          // if (
          //   xs[i] + xBinIncr >= scaleX.min! &&
          //   xs[i] - xBinIncr <= scaleX.max! &&
          //   ys[i] + yBinIncr >= scaleY.min! &&
          //   ys[i] - yBinIncr <= scaleY.max!
          // ) {
          let fillPath = fillPaths[fills[i]];

          rect(fillPath, x, y, xSize, ySize);

          each(u, 1, i, x, y, xSize, ySize);
          //  }
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

        return null;
      }
    );
  };
}

export const countsToFills = (counts: number[], palette: string[]) => {
  // TODO: integrate 1e-9 hideThreshold?
  const hideThreshold = 0;

  let minCount = Infinity;
  let maxCount = -Infinity;

  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > hideThreshold) {
      minCount = Math.min(minCount, counts[i]);
      maxCount = Math.max(maxCount, counts[i]);
    }
  }

  let range = maxCount - minCount;

  let paletteSize = palette.length;

  let indexedFills = Array(counts.length);

  for (let i = 0; i < counts.length; i++) {
    indexedFills[i] =
      counts[i] === 0 ? -1 : Math.min(paletteSize - 1, Math.floor((paletteSize * (counts[i] - minCount)) / range));
  }

  return indexedFills;
};
