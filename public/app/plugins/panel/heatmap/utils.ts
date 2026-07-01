import { type RefObject } from 'react';
import uPlot, { type Cursor } from 'uplot';

import {
  DataFrameType,
  formattedValueToString,
  getValueFormat,
  type GrafanaTheme2,
  incrRoundDn,
  incrRoundUp,
  type TimeRange,
  FieldType,
  getDisplayProcessor,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { AxisPlacement, ScaleDirection, ScaleDistribution, ScaleOrientation, HeatmapCellLayout } from '@grafana/schema';
import { UPlotConfigBuilder, type UPlotConfigPrepFn } from '@grafana/ui';
import {
  calculateBucketFactor,
  isHeatmapCellsDense,
  readHeatmapRowsCustomMeta,
} from 'app/features/transformers/calculateHeatmap/heatmap';

import { pointWithin, Quadtree, type Rect } from '../barchart/quadtree';

import { type HeatmapData } from './fields';
import { type FieldConfig, HeatmapSelectionMode, type YAxisConfig } from './panelcfg.gen';

/** Validates and returns a safe log base (2 or 10), defaults to 2 if invalid */
export function toLogBase(value: number | undefined): 2 | 10 {
  return value === 10 ? 10 : 2;
}

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
  xAxisConfig?: Parameters<UPlotConfigPrepFn>[0]['xAxisConfig'];
  rowsFrame?: { yBucketScale?: { type: ScaleDistribution; log?: number; linearThreshold?: number } };
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
    xAxisConfig,
    rowsFrame,
  } = opts;

  const yBucketScale = rowsFrame?.yBucketScale;

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

  let xField = dataRef.current?.heatmap?.fields[0]!;
  xField.display ??= getDisplayProcessor({
    field: xField,
    theme,
    timeZone,
  });

  builder.addAxis({
    scaleKey: xScaleKey,
    placement: AxisPlacement.Bottom,
    incrs,
    isTime,
    theme: theme,
    timeZone,
    formatValue:
      isTime && xField.config.unit?.startsWith('time:')
        ? (v, decimals) => xField.display!(v, decimals).text
        : undefined,
    ...xAxisConfig,
  });

  const yField = dataRef.current?.heatmap?.fields[1]!;
  if (!yField) {
    return builder; // early abort (avoids error)
  }

  const yFieldConfig: FieldConfig | undefined = yField.config?.custom;
  const yScale = yFieldConfig?.scaleDistribution ?? { type: ScaleDistribution.Linear };
  const yAxisReverse = Boolean(yAxisConfig.reverse);
  const isSparseHeatmap = heatmapType === DataFrameType.HeatmapCells && !isHeatmapCellsDense(dataRef.current?.heatmap!);

  // Native histograms that include negative or zero-straddling buckets (e.g.
  // exponential histograms with a zero bucket and a negative range) can't be
  // displayed on a pure log y-axis. Detect this and switch to symlog, which has
  // a linear region around zero (where the zero bucket sits) flanked by
  // logarithmic regions for the positive and negative buckets. Pure-positive
  // sparse heatmaps keep their existing log behavior.
  const sparseNonPositiveBounds: ReturnType<typeof findSymlogBounds> = (() => {
    if (!config.featureToggles.heatmapNegativeLogBuckets || !isSparseHeatmap) {
      return { hasNonPositive: false, smallestMagnitude: null };
    }
    const fields = dataRef.current?.heatmap?.fields ?? [];
    const yMin = fields.find((f) => f.name === 'yMin')?.values ?? [];
    const yMax = fields.find((f) => f.name === 'yMax')?.values ?? [];
    return findSymlogBounds(yMin, yMax);
  })();

  // linearThreshold is the half-width of the linear region in the symlog
  // axis. Pick it at the bucket boundary closest to zero (on either side):
  // uPlot's asinh split generator always emits a tick at the linear threshold,
  // so this places a labeled tick exactly on that innermost bucket boundary
  // while keeping the linear strip around zero narrow.
  // A histogram whose only populated bucket is the (skipped) zero bucket has no
  // real-magnitude boundary to anchor the linear threshold to. Rather than fall
  // back to a pure log scale — which can't place a zero/straddling bucket and
  // renders blank — engage symlog with a default threshold so the lone zero band
  // is still drawn on a sane axis.
  const ZERO_ONLY_SYMLOG_THRESHOLD = 1;
  const sparseZeroBucketOnly =
    config.featureToggles.heatmapNegativeLogBuckets &&
    sparseNonPositiveBounds.hasNonPositive &&
    sparseNonPositiveBounds.smallestMagnitude == null;
  const sparseSymlogLinearThreshold =
    config.featureToggles.heatmapNegativeLogBuckets && sparseNonPositiveBounds.hasNonPositive
      ? (sparseNonPositiveBounds.smallestMagnitude ?? ZERO_ONLY_SYMLOG_THRESHOLD)
      : null;

  const scaleDistribution = (() => {
    if (yBucketScale) {
      return yBucketScale.type;
    }
    if (sparseSymlogLinearThreshold != null) {
      return ScaleDistribution.Symlog;
    }
    if (yScale.type !== ScaleDistribution.Linear || isSparseHeatmap) {
      return ScaleDistribution.Log;
    }
    return ScaleDistribution.Linear;
  })();

  const scaleLog = toLogBase(yBucketScale?.log ?? yScale.log);
  const scaleLinearThreshold = yBucketScale?.linearThreshold ?? sparseSymlogLinearThreshold ?? undefined;

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
    distribution: scaleDistribution,
    log: scaleLog,
    linearThreshold: scaleLinearThreshold,
    range:
      // sparse already accounts for le/ge by explicit yMin & yMax cell bounds, so no need to expand y range
      isSparseHeatmap
        ? (u, dataMin, dataMax) => {
            // Extract yMin and yMax arrays
            const yMinData = u.data[1]?.[1];
            const yMaxData = u.data[1]?.[2];
            const yMinValues = Array.isArray(yMinData) ? yMinData : [];
            const yMaxValues = Array.isArray(yMaxData) ? yMaxData : [];

            // uPlot auto-ranges from the yMin facet data, so we grow by one bucket factor.
            // When yMin values are all 0, multiplicative expansion stays 0; fall back to max(yMax).
            const bucketFactor = calculateBucketExpansionFactor(yMinValues, yMaxValues);
            dataMax *= bucketFactor;
            if (dataMax <= 0) {
              dataMax = yMaxValues.reduce<number>((acc, v) => (typeof v === 'number' && v > acc ? v : acc), 1);
            }

            let scaleMin: number | null, scaleMax: number | null;

            const isLogScale =
              scaleDistribution === ScaleDistribution.Log || scaleDistribution === ScaleDistribution.Symlog;
            if (sparseSymlogLinearThreshold != null) {
              if (sparseZeroBucketOnly) {
                // Data is entirely the zero bucket (no real-magnitude buckets).
                // Show a small symmetric window centered on zero so the single
                // zero band is visible instead of collapsing to a degenerate or
                // blank axis.
                const t = sparseSymlogLinearThreshold;
                [scaleMin, scaleMax] = [-t, t];
              } else {
                // Auto-detected symlog (negative/zero buckets present). The y-scale
                // auto-ranges over the yMin facet only, so the passed dataMin is the
                // lowest bucket's lower bound while the passed dataMax misses the top
                // bucket's upper bound (which lives in the yMax facet). Recover the
                // true top extent, then snap both ends out to clean powers of the base
                // (see snapSymlogRange) so the outermost buckets get headroom off the
                // axis edges and the span lines up with the pure-log axis.
                let hi = dataMax;
                for (const v of yMaxValues) {
                  if (typeof v === 'number' && Number.isFinite(v) && v > hi) {
                    hi = v;
                  }
                }
                [scaleMin, scaleMax] = snapSymlogRange(dataMin, hi, sparseSymlogLinearThreshold, scaleLog || 2);
              }
            } else if (isLogScale) {
              // Guard against non-positive values — log(0) = -Infinity causes uPlot to crash in logAxisSplits.
              const safeMin = dataMin > 0 ? dataMin : dataMax / Math.pow(scaleLog, 2);
              [scaleMin, scaleMax] = uPlot.rangeLog(safeMin, dataMax, scaleLog, true);
            } else {
              [scaleMin, scaleMax] = [dataMin, dataMax];
            }

            let { min: explicitMin, max: explicitMax } = yAxisConfig;

            if (sparseSymlogLinearThreshold == null && isLogScale && !isOrdinalY) {
              let yExp = u.scales[yScaleKey].log!;
              let log = yExp === 2 ? Math.log2 : Math.log10;

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
            } else if (!isOrdinalY) {
              // Apply explicit min/max for linear and (auto-detected) symlog scales
              [scaleMin, scaleMax] = applyExplicitMinMax(scaleMin, scaleMax, explicitMin, explicitMax);
            }

            return [scaleMin, scaleMax];
          }
        : // dense and ordinal only have one of yMin|yMax|y, so expand range by one cell in the direction of le/ge/unknown
          (u, dataMin, dataMax) => {
            let scaleMin = dataMin,
              scaleMax = dataMax;

            let { min: explicitMin, max: explicitMax } = yAxisConfig;

            // logarithmic expansion
            if (scaleDistribution === ScaleDistribution.Log || scaleDistribution === ScaleDistribution.Symlog) {
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

              // For pre-bucketed data with explicit scale, calculate expansion factor from actual bucket spacing
              // For calculated heatmaps, use the full log base
              let expansionFactor: number = yExp;

              if (yBucketScale !== undefined) {
                // Try to infer the bucket factor from the actual data spacing
                const yValues = u.data[1]?.[1];
                if (Array.isArray(yValues) && yValues.length >= 2 && typeof yValues[0] === 'number') {
                  expansionFactor = calculateBucketFactor(yValues, yExp);
                }
              }

              if (dataRef.current?.yLayout === HeatmapCellLayout.le) {
                if (!minExpanded) {
                  scaleMin /= expansionFactor;
                }
              } else if (dataRef.current?.yLayout === HeatmapCellLayout.ge) {
                if (!maxExpanded) {
                  scaleMax *= expansionFactor;
                }
              } else {
                // Unknown layout - expand both directions
                const factor = Math.sqrt(expansionFactor); // Use sqrt for balanced expansion
                scaleMin /= factor;
                scaleMax *= factor;
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
    splits:
      // Gate on the auto-detected symlog case, not `scaleDistribution === Symlog`:
      // a manually-selected Symlog y-bucket scale must keep uPlot's default ticks
      // (this override is part of the flag-gated native-histogram feature).
      sparseSymlogLinearThreshold != null
        ? (self: uPlot, _axisIdx: number, sMin: number, sMax: number) =>
            // Tick/gridline at the y=0 seam plus every power of the base in range, so
            // gridlines land on each power (matching the pure-log axis). uPlot's own
            // asinh generator instead anchors at the non-power linthresh and cascades
            // into awkward values (0.989, 1.49, 2.98, …). Label thinning is handled in
            // `values`, which keeps all the gridlines.
            symlogPowerSplits(sMin, sMax, scaleLinearThreshold ?? 1, scaleLog || 2)
        : isOrdinalY
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
    values:
      sparseSymlogLinearThreshold != null
        ? (self: uPlot, splits: number[], _axisIdx: number, foundSpace: number) => {
            // Gridlines/ticks stay on every power (the splits above); thin only the
            // labels, anchored at the largest power and skipping every Nth downward.
            // This mirrors uPlot's log2 axis (log2AxisValsFilt): keep at most one label
            // per axis._space (passed here as foundSpace). The y=0 seam is always kept.
            const base = scaleLog || 2;
            // Pixels between two adjacent powers at the start of the log region.
            // Measure at the linear threshold rather than base..base^2: when the
            // threshold is large (e.g. 128) those small powers fall inside the linear
            // region and collapse to ~0px, which would over-thin the labels.
            const t = scaleLinearThreshold ?? 1;
            const magSpace = Math.abs(self.valToPos(t, yScaleKey) - self.valToPos(t * base, yScaleKey));
            // keepMod = ceil(space / magSpace), exactly as the log2 axis. When the
            // panel is so short that adjacent powers collapse to one pixel
            // (magSpace -> 0 / NaN), thin maximally to the anchor power + the seam
            // rather than snapping back to "label everything".
            const keepMod =
              Number.isFinite(magSpace) && magSpace > 0 ? Math.max(1, Math.ceil(foundSpace / magSpace)) : splits.length;
            const keep = symlogLabelMask(splits, keepMod, base);
            return splits.map((v, i) => (keep[i] ? formattedValueToString(dispY(v)) : null));
          }
        : isOrdinalY
          ? (self: uPlot, splits) => {
              const meta = readHeatmapRowsCustomMeta(dataRef.current?.heatmap);
              if (meta.yOrdinalDisplay) {
                return splits.map((v) =>
                  v < 0
                    ? (meta.yMinDisplay ?? '') // Check prometheus style labels
                    : (meta.yOrdinalDisplay?.[v] ?? '')
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
      yAlign: (() => {
        const yAlign =
          dataRef.current?.yLayout === HeatmapCellLayout.le
            ? -1
            : dataRef.current?.yLayout === HeatmapCellLayout.ge
              ? 1
              : 0;
        return yAxisReverse ? (yAlign === -1 ? 1 : yAlign === 1 ? -1 : 0) : yAlign;
      })(),
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
          // For log scales, calculate cell size from actual adjacent bucket positions
          const nextXValue = xs[yBinQty] ?? xs[0] * scaleX.log!;
          xSize = Math.abs(valToPosX(nextXValue, scaleX, xDim, xOff) - valToPosX(xs[0], scaleX, xDim, xOff));
        } else {
          xSize = Math.abs(valToPosX(xBinIncr, scaleX, xDim, xOff) - valToPosX(0, scaleX, xDim, xOff));
        }

        if (scaleY.distr === 3) {
          // Use actual data spacing for pre-bucketed data, or full magnitude for calculated heatmaps with splits
          const nextYValue = ySizeDivisor === 1 ? (ys[1] ?? ys[0] * scaleY.log!) : ys[0] * scaleY.log!;

          const baseYSize = Math.abs(valToPosY(nextYValue, scaleY, yDim, yOff) - valToPosY(ys[0], scaleY, yDim, yOff));
          ySize = baseYSize / ySizeDivisor;
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

  // Special zero-bucket rendering is part of the negative/zero-bucket feature.
  const negativeBucketsEnabled = config.featureToggles.heatmapNegativeLogBuckets ?? false;

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

        // The exponential histogram zero bucket straddles zero with bounds so
        // small (e.g. ±1e-128 for OTel SDK defaults) that valToPosY collapses it
        // to a sub-pixel line on the y=0 symlog seam. The cells carry no metadata
        // flagging it, so detect it geometrically: a zero-straddling bucket whose
        // natural rendered height is sub-pixel. This is independent of which
        // neighboring buckets happen to be present (sparse encoding omits empty
        // ones), unlike comparing the bucket width against the linear threshold.
        // A genuinely wide zero-straddling bucket (e.g. an NHCB bucket spanning
        // negative to positive) has a real pixel height and renders normally.
        const MIN_VISIBLE_PX = 2;
        const isZeroBucket = (i: number): boolean => {
          if (!negativeBucketsEnabled) {
            return false;
          }
          const lo = yMins[i];
          const hi = yMaxs[i];
          if (!(Number.isFinite(lo) && Number.isFinite(hi) && lo < 0 && hi > 0)) {
            return false;
          }
          return yOffs.get(lo) - yOffs.get(hi) < MIN_VISIBLE_PX;
        };

        // Pixel of the y=0 line (finite on symlog) and the median height of the
        // other buckets, used to size and place the zero-bucket row so it carries
        // the same visual weight instead of rendering as a hairline.
        let zeroPx = 0;
        let zeroBucketHeight = 0;
        // Track whether real buckets exist on each side of zero, so a one-sided
        // histogram's zero band fills the populated side rather than wasting half
        // its height in the empty side.
        let hasNeg = false;
        let hasPos = false;
        if (negativeBucketsEnabled) {
          zeroPx = round(valToPosY(0, scaleY, yDim, yOff));
          const neighborHeights: number[] = [];
          for (let i = 0; i < dlen; i++) {
            if (isZeroBucket(i)) {
              continue;
            }
            if (Number.isFinite(yMaxs[i]) && yMaxs[i] <= 0) {
              hasNeg = true;
            }
            if (Number.isFinite(yMins[i]) && yMins[i] >= 0) {
              hasPos = true;
            }
            const h = yOffs.get(yMins[i]) - yOffs.get(yMaxs[i]);
            if (Number.isFinite(h) && h > 0) {
              neighborHeights.push(h);
            }
          }
          if (neighborHeights.length > 0) {
            neighborHeights.sort((a, b) => a - b);
            zeroBucketHeight = neighborHeights[Math.floor(neighborHeights.length / 2)];
          } else {
            // Only the zero bucket is populated; fall back to a small visible row.
            zeroBucketHeight = Math.max(1, Math.round(yDim / 20));
          }
        }

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

          // A sub-pixel zero-straddling bucket would otherwise render as a hairline;
          // give it a fixed-height row with the same visual weight as its neighbors.
          // Straddle the y=0 line when buckets exist on both sides (or none — the
          // all-zero case), reflecting the exponential zero bucket's [-eps, +eps] span;
          // when buckets are only on one side, fill that side so a one-sided histogram's
          // band isn't left half as tall as its neighbors. Flag-gated via isZeroBucket.
          if (isZeroBucket(i)) {
            ySize = Math.max(1, zeroBucketHeight - cellGap);
            if (hasPos && !hasNeg) {
              y = zeroPx - ySize; // positive-only: extend upward from the seam
            } else if (hasNeg && !hasPos) {
              y = zeroPx; // negative-only: extend downward from the seam
            } else {
              y = zeroPx - ySize / 2; // both sides or all-zero: straddle, centered
            }
          }

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

/**
 * Inspects sparse heatmap bucket bounds to decide whether the y-axis needs a
 * symlog (rather than pure log) scale, and where its linear threshold should
 * sit.
 *
 * A native histogram with negative or zero-straddling buckets can't be drawn
 * on a pure log axis. `hasNonPositive` flags that case.
 *
 * `smallestMagnitude` is the bucket boundary closest to zero across *both* the
 * positive and negative sides — the symlog linear threshold is placed here so
 * the innermost real bucket on each side stays in the log region. Straddling
 * buckets (the exponential zero bucket with bounds at ±epsilon) have
 * boundaries that are effectively zero, which would otherwise collapse the
 * linear region to almost nothing, so they are skipped.
 *
 * @param yMinValues - Array of yMin bucket boundary values
 * @param yMaxValues - Array of yMax bucket boundary values
 */
export function findSymlogBounds(
  yMinValues: unknown[],
  yMaxValues: unknown[]
): { hasNonPositive: boolean; smallestMagnitude: number | null } {
  let hasNonPositive = false;
  let smallestMagnitude = Infinity;
  const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

  for (let i = 0; i < Math.max(yMinValues.length, yMaxValues.length); i++) {
    const lo = yMinValues[i];
    const hi = yMaxValues[i];
    if (isFiniteNum(lo) && lo <= 0) {
      hasNonPositive = true;
    }
    if (isFiniteNum(hi) && hi <= 0) {
      hasNonPositive = true;
    }
    const isStraddler = isFiniteNum(lo) && lo < 0 && isFiniteNum(hi) && hi > 0;
    if (isStraddler) {
      continue;
    }
    if (isFiniteNum(lo) && lo !== 0 && Math.abs(lo) < smallestMagnitude) {
      smallestMagnitude = Math.abs(lo);
    }
    if (isFiniteNum(hi) && hi !== 0 && Math.abs(hi) < smallestMagnitude) {
      smallestMagnitude = Math.abs(hi);
    }
  }

  return {
    hasNonPositive,
    smallestMagnitude: smallestMagnitude === Infinity ? null : smallestMagnitude,
  };
}

/**
 * Computes the y-scale [min, max] for an auto-detected sparse symlog heatmap.
 *
 * The y-scale auto-ranges over the yMin facet only, so `lo` is the lowest bucket's
 * lower bound and `hi` must be supplied as the largest yMax (the top bucket's upper
 * bound, which the yMin facet misses). Each log-region end is snapped out to the
 * next power of `base` away from zero — mirroring uPlot.rangeLog(fullMags) on the
 * pure-log axis. This gives the outermost buckets headroom off the axis edges (so a
 * lone negative bucket isn't crushed onto the baseline) and makes the span land on
 * clean powers, lining the ticks/gridlines up with the pure-log axis. Values inside
 * the linear region (|v| <= threshold, e.g. a zero-straddling bucket) are kept as-is.
 */
export function snapSymlogRange(lo: number, hi: number, linthresh: number, base: number): [number, number] {
  const logB = (x: number) => Math.log(x) / Math.log(base);
  const nextPow = (x: number) => Math.pow(base, Math.floor(logB(x)) + 1);
  const scaleMax = hi > linthresh ? nextPow(hi) : linthresh;
  const scaleMin = lo < -linthresh ? -nextPow(-lo) : lo < 0 ? lo : -linthresh;
  return [scaleMin, scaleMax];
}

/**
 * Splits (tick/gridline positions) for a symlog y-axis: the y=0 seam plus every
 * power of `base` whose magnitude falls within [scaleMin, scaleMax] on each side.
 * Gridlines land on each power, matching the pure-log axis (uPlot's built-in asinh
 * generator instead anchors at the non-power linthresh, producing awkward values).
 */
export function symlogPowerSplits(scaleMin: number, scaleMax: number, linthresh: number, base: number): number[] {
  const logB = (x: number) => Math.log(x) / Math.log(base);
  const maxMag = Math.max(Math.abs(scaleMin), Math.abs(scaleMax), linthresh);
  const splits = [0];
  for (let k = Math.ceil(logB(linthresh) - 1e-9); Math.pow(base, k) <= maxMag * (1 + 1e-9); k++) {
    const p = Math.pow(base, k);
    if (p <= scaleMax * (1 + 1e-9)) {
      splits.push(p);
    }
    if (-p >= scaleMin * (1 + 1e-9)) {
      splits.push(-p);
    }
  }
  splits.sort((a, b) => a - b);
  return splits;
}

/**
 * Decides which symlog splits get a label (gridlines stay on all of them). The y=0
 * seam is always labeled; powers are kept every `keepMod`-th, anchored at the largest
 * magnitude and counting down — the spacing-aware every-Nth-power scheme uPlot's log2
 * axis uses (keepMod is derived from pixel spacing by the caller). Returns a boolean
 * mask aligned to `splits`.
 */
export function symlogLabelMask(splits: number[], keepMod: number, base: number): boolean[] {
  const logB = (x: number) => Math.log(x) / Math.log(base);
  const maxMag = splits.reduce((m, v) => Math.max(m, Math.abs(v)), base);
  const kMax = Math.round(logB(maxMag));
  return splits.map((v) => {
    if (v === 0) {
      return true;
    }
    const k = Math.round(logB(Math.abs(v)));
    return (kMax - k) % keepMod === 0;
  });
}

/**
 * Calculates a bucket expansion factor from yMin/yMax data arrays.
 * Used to expand the y-axis range for sparse heatmaps where uPlot only auto-ranges from yMin.
 *
 * @param yMinValues - Array of yMin bucket boundary values
 * @param yMaxValues - Array of yMax bucket boundary values
 * @returns A valid expansion factor, or 1 as fallback
 */
export function calculateBucketExpansionFactor(yMinValues: unknown[], yMaxValues: unknown[]): number {
  // Guard against invalid bucket factors (e.g., division by zero when first bucket starts at 0)
  for (let i = 0; i < yMinValues.length; i++) {
    const yMin = yMinValues[i];
    const yMax = yMaxValues[i];
    if (typeof yMin !== 'number' || typeof yMax !== 'number') {
      continue;
    }
    const factor = yMax / yMin;
    // finite checks for divide-by-zero
    if (Number.isFinite(factor) && factor > 0) {
      return factor;
    }
  }

  return 1;
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

/**
 * Calculates the Y-axis size divisor for heatmap cell rendering.
 * For log/symlog scales with calculated data (no explicit scale), divides cells by the split value.
 * Otherwise returns 1 (no division).
 */
export function calculateYSizeDivisor(
  scaleType: ScaleDistribution | undefined,
  hasExplicitScale: boolean,
  splitValue: number | string | undefined
): number {
  const isLogScale = scaleType === ScaleDistribution.Log || scaleType === ScaleDistribution.Symlog;
  return isLogScale && !hasExplicitScale ? +(splitValue || 1) : 1;
}

/**
 * Applies explicit min/max values to scale range for linear scales.
 * Returns the original values if explicitMin/explicitMax are undefined.
 */
export function applyExplicitMinMax(
  scaleMin: number | null,
  scaleMax: number | null,
  explicitMin: number | undefined,
  explicitMax: number | undefined
): [number | null, number | null] {
  return [explicitMin ?? scaleMin, explicitMax ?? scaleMax];
}
