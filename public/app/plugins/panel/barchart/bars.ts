import uPlot, { Axis, AlignedData, Scale } from 'uplot';

import { colorManipulator, DataFrame, dateTimeFormat, GrafanaTheme2, systemDateFormats, TimeZone } from '@grafana/data';
import {
  StackingMode,
  VisibilityMode,
  ScaleDirection,
  ScaleOrientation,
  VizTextDisplayOptions,
  VizLegendOptions,
} from '@grafana/schema';
import { measureText } from '@grafana/ui';
import { timeUnitSize, StackingGroup, preparePlotData2, getStackingGroups } from '@grafana/ui/internal';

const intervals = systemDateFormats.interval;

import { distribute, SPACE_BETWEEN, SPACE_EVENLY } from './distribute';
import { findRects, intersects, pointWithin, Quadtree, Rect } from './quadtree';

const groupDistr = SPACE_BETWEEN;
const barDistr = SPACE_BETWEEN;
const clusterDistr = SPACE_BETWEEN;
// min.max font size for value label
const VALUE_MIN_FONT_SIZE = 8;
const VALUE_MAX_FONT_SIZE = 30;
// % of width/height of the bar that value should fit in when measuring size
const BAR_FONT_SIZE_RATIO = 0.65;
// distance between label and a bar in % of bar width
const LABEL_OFFSET_FACTOR_VT = 0.1;
const LABEL_OFFSET_FACTOR_HZ = 0.15;
// max distance
const LABEL_OFFSET_MAX_VT = 5;
const LABEL_OFFSET_MAX_HZ = 10;

// text baseline middle runs through the middle of lowercase letters
// since bar values are numbers and uppercase-like, we want the middle of uppercase
// this is a cheap fudge factor that skips expensive and inconsistent cross-browser measuring
const MIDDLE_BASELINE_SHIFT = 0.1;

/**
 * @internal
 */
export interface BarsOptions {
  xOri: ScaleOrientation;
  xDir: ScaleDirection;
  groupWidth: number;
  clusterWidth: number;
  barWidth: number;
  barRadius: number;
  showValue: VisibilityMode;
  stacking: StackingMode;
  groupByField?: string;
  rawValue: (seriesIdx: number, valueIdx: number) => number | null;
  getColor?: (seriesIdx: number, valueIdx: number, value: unknown) => string | null;
  fillOpacity?: number;
  formatValue: (seriesIdx: number, value: unknown) => string;
  formatShortValue: (seriesIdx: number, value: unknown) => string;
  timeZone?: TimeZone;
  text?: VizTextDisplayOptions;
  hoverMulti?: boolean;
  legend?: VizLegendOptions;
  xSpacing?: number;
  xTimeAuto?: boolean;
  negY?: boolean[];
  fullHighlight?: boolean;
}

/**
 * @internal
 */
interface ValueLabelTable {
  [index: number]: ValueLabelArray;
}

/**
 * @internal
 */
interface ValueLabelArray {
  [index: number]: ValueLabel;
}

/**
 * @internal
 */
interface ValueLabel {
  text: string;
  value: number | null;
  hidden: boolean;
  bbox?: Rect;
  textMetrics?: TextMetrics;
  x?: number;
  y?: number;
}

/**
 * @internal
 */
function calculateFontSizeWithMetrics(
  text: string,
  width: number,
  height: number,
  lineHeight: number,
  maxSize?: number
) {
  // calculate width in 14px
  const textSize = measureText(text, 14);
  // how much bigger than 14px can we make it while staying within our width constraints
  const fontSizeBasedOnWidth = (width / (textSize.width + 2)) * 14;
  const fontSizeBasedOnHeight = height / lineHeight;

  // final fontSize
  const optimalSize = Math.min(fontSizeBasedOnHeight, fontSizeBasedOnWidth);
  return {
    fontSize: Math.min(optimalSize, maxSize ?? optimalSize),
    textMetrics: textSize,
  };
}

/**
 * @internal
 */
export function getConfig(opts: BarsOptions, theme: GrafanaTheme2) {
  const {
    xOri,
    xDir: dir,
    rawValue,
    getColor,
    formatValue,
    formatShortValue,
    fillOpacity = 1,
    showValue,
    xSpacing = 0,
    hoverMulti = false,
    timeZone = 'browser',
    groupByField,
  } = opts;
  const isXHorizontal = xOri === ScaleOrientation.Horizontal;
  const hasAutoValueSize = !Boolean(opts.text?.valueSize);
  const isStacked = opts.stacking !== StackingMode.None;
  const pctStacked = opts.stacking === StackingMode.Percent;

  let { clusterWidth, groupWidth, barWidth, barRadius = 0 } = opts;

  if (isStacked) {
    [groupWidth, barWidth] = [barWidth, groupWidth];
  }

  let qt: Quadtree;
  const numSeries = 30; // !!
  const hovered: Array<Rect | null> = Array(numSeries).fill(null);
  let hRect: Rect | null;

  // for distr: 2 scales, the splits array should contain indices into data[0] rather than values
  const xSplits: Axis.Splits | undefined = (u) => Array.from(u.data[0].map((v, i) => i));

  const hFilter: Axis.Filter | undefined =
    xSpacing === 0
      ? undefined
      : (u, splits) => {
          // hSpacing?
          const dim = u.bbox.width;
          const _dir = dir * (isXHorizontal ? 1 : -1);

          let dataLen = splits.length;
          let lastIdx = dataLen - 1;

          let skipMod = 0;

          let cssDim = dim / uPlot.pxRatio;
          let maxTicks = Math.abs(Math.floor(cssDim / xSpacing));

          skipMod = dataLen < maxTicks ? 0 : Math.ceil(dataLen / maxTicks);

          let splits2 = splits.map((v, i) => {
            let shouldSkip = skipMod !== 0 && (xSpacing > 0 ? i : lastIdx - i) % skipMod > 0;
            return shouldSkip ? null : v;
          });

          return _dir === 1 ? splits2 : splits2.reverse();
        };

  // the splits passed into here are data[0] values looked up by the indices returned from splits()
  const xValues: Axis.Values = (u, splits, axisIdx, foundSpace, foundIncr) => {
    if (opts.xTimeAuto) {
      let format = intervals.year;

      if (foundIncr < timeUnitSize.second) {
        format = intervals.millisecond;
      } else if (foundIncr < timeUnitSize.minute) {
        format = intervals.second;
      } else if (foundIncr < timeUnitSize.hour) {
        format = intervals.minute;
      } else if (foundIncr < timeUnitSize.day) {
        format = intervals.hour;
      } else if (foundIncr < timeUnitSize.month) {
        format = intervals.day;
      } else if (foundIncr < timeUnitSize.year) {
        format = intervals.month;
      } else {
        format = intervals.year;
      }

      return splits.map((v) => (v == null ? '' : dateTimeFormat(v, { format, timeZone })));
    }

    return splits.map((v) => (isXHorizontal ? formatShortValue(0, v) : formatValue(0, v)));
  };

  // this expands the distr: 2 scale so that the indicies of each data[0] land at the proper justified positions
  const xRange: Scale.Range = (u, min, max) => {
    min = 0;
    max = Math.max(1, u.data[0].length - 1);

    let pctOffset = 0;

    // how far in is the first tick in % of full dimension
    distribute(u.data[0].length, groupWidth, groupDistr, 0, (di, lftPct, widPct) => {
      pctOffset = lftPct + widPct / 2;
    });

    // expand scale range by equal amounts on both ends
    let rn = max - min;

    if (pctOffset === 0.5) {
      min -= rn;
    } else {
      let upScale = 1 / (1 - pctOffset * 2);
      let offset = (upScale * rn - rn) / 2;

      min -= offset;
      max += offset;
    }

    return [min, max];
  };

  // non-stacked distribution
  let distrTwo = (groupCount: number, barCount: number) => {
    let out = Array.from({ length: barCount }, () => ({
      offs: Array(groupCount).fill(0),
      size: Array(groupCount).fill(0),
    }));

    distribute(groupCount, groupWidth, groupDistr, null, (groupIdx, groupOffPct, groupDimPct) => {
      distribute(barCount, barWidth, barDistr, null, (barIdx, barOffPct, barDimPct) => {
        out[barIdx].offs[groupIdx] = groupOffPct + groupDimPct * barOffPct;
        out[barIdx].size[groupIdx] = groupDimPct * barDimPct;
      });
    });

    return out;
  };

  // stacked distribution
  let distrOne = (groupCount: number, barCount: number) => { 
    let out = Array.from({ length: barCount }, () => ({
      offs: Array(groupCount).fill(0),
      size: Array(groupCount).fill(0),
    }));

    distribute(groupCount, groupWidth, groupDistr, null, (groupIdx, groupOffPct, groupDimPct) => {
      distribute(barCount, barWidth, barDistr, null, (barIdx, barOffPct, barDimPct) => {
        out[barIdx].offs[groupIdx] = groupOffPct;
        out[barIdx].size[groupIdx] = groupDimPct;
      });
    });

    return out;
  };

  let distrClusteredStacked = (groupCount: number, barCount: number, clusterCount: number, groupsPerCluster: number[]) => {
    let out = Array.from({ length: barCount }, () => ({
      offs: Array(groupCount).fill(0),
      size: Array(groupCount).fill(0),
    }));

    let groupOffset = 0; // running index into groups

    // distribute clusters across the entire x-axis
    distribute(clusterCount, clusterWidth, clusterDistr, null, (clusterIdx, clusterOffPct, clusterDimPct) => {
      const groupsInCurrentCluster = groupsPerCluster[clusterIdx]; // number of groups in this cluster
      const start = groupOffset;
      const end = groupOffset + groupsInCurrentCluster;
      groupOffset = end;

      // distribute groups within cluster
      distribute(groupsInCurrentCluster, groupWidth, groupDistr, null, (localGroupIdx, groupOffPct, groupDimPct) => {
        const globalGroupIdx = start + localGroupIdx;
        const offset = clusterOffPct + clusterDimPct * groupOffPct;
        const size = clusterDimPct * groupDimPct;

        // In stacked mode: all stacked bars share same offset and size.
        for (let bar = 0; bar < barCount; bar++) {
          out[bar].offs[globalGroupIdx] = offset; // fraction of total x-axis as left starting point
          out[bar].size[globalGroupIdx] = size;
        }
      });
    });

    return out;
  };


  const LABEL_OFFSET_FACTOR = isXHorizontal ? LABEL_OFFSET_FACTOR_VT : LABEL_OFFSET_FACTOR_HZ;
  const LABEL_OFFSET_MAX = isXHorizontal ? LABEL_OFFSET_MAX_VT : LABEL_OFFSET_MAX_HZ;

  let barsPctLayout: Array<null | { offs: number[]; size: number[] }> = [];
  let barsColors: Array<null | { fill: Array<string | null>; stroke: Array<string | null> }> = [];
  let scaleFactor = 1;
  let labels: ValueLabelTable;
  let fontSize = opts.text?.valueSize ?? VALUE_MAX_FONT_SIZE;
  let labelOffset = LABEL_OFFSET_MAX;

  // minimum available space for labels between bar end and plotting area bound (in canvas pixels)
  let vSpace = Infinity;
  let hSpace = Infinity;

  let useMappedColors = getColor != null;

  let mappedColorDisp = useMappedColors
    ? {
        fill: {
          unit: 3,
          values: (u: uPlot, seriesIdx: number) => barsColors[seriesIdx]!.fill,
        },
        stroke: {
          unit: 3,
          values: (u: uPlot, seriesIdx: number) => barsColors[seriesIdx]!.stroke,
        },
      }
    : {};

  let barsBuilder = uPlot.paths.bars!({
    radius: pctStacked
      ? 0
      : !isStacked
        ? barRadius
        : (u: uPlot, seriesIdx: number) => {
            let isTopmostSeries = seriesIdx === u.data.length - 1;
            return isTopmostSeries ? [barRadius, 0] : [0, 0];
          },
    disp: {
      x0: {
        unit: 2,
        values: (u, seriesIdx) => barsPctLayout[seriesIdx]!.offs,
      },
      size: {
        unit: 2,
        values: (u, seriesIdx) => barsPctLayout[seriesIdx]!.size,
      },
      ...mappedColorDisp,
    },
    // collect rendered bar geometry
    each: (u, seriesIdx, dataIdx, lft, top, wid, hgt) => {
      // we get back raw canvas coords (included axes & padding)
      // translate to the plotting area origin
      lft -= u.bbox.left;
      top -= u.bbox.top;

      let val = u.data[seriesIdx][dataIdx]!;
      // accum min space abvailable for labels
      if (isXHorizontal) {
        vSpace = Math.min(vSpace, val < 0 ? u.bbox.height - (top + hgt) : top);
        hSpace = wid;
      } else {
        vSpace = hgt;
        hSpace = Math.min(hSpace, val < 0 ? lft : u.bbox.width - (lft + wid));
      }

      let barRect = { x: lft, y: top, w: wid, h: hgt, sidx: seriesIdx, didx: dataIdx };

      if (!isStacked && opts.fullHighlight) {
        if (opts.xOri === ScaleOrientation.Horizontal) {
          barRect.y = 0;
          barRect.h = u.bbox.height;
        } else {
          barRect.x = 0;
          barRect.w = u.bbox.width;
        }
      }

      qt.add(barRect);

      if (showValue !== VisibilityMode.Never) {
        const raw = rawValue(seriesIdx, dataIdx)!;
        let divider = 1;

        if (pctStacked && alignedTotals![seriesIdx][dataIdx]!) {
          divider = alignedTotals![seriesIdx][dataIdx]!;
        }

        const v = divider === 0 ? 0 : raw / divider;
        // Format Values and calculate label offsets
        const text = formatValue(seriesIdx, v);
        labelOffset = Math.min(labelOffset, Math.round(LABEL_OFFSET_FACTOR * (isXHorizontal ? wid : hgt)));

        if (labels[dataIdx] === undefined) {
          labels[dataIdx] = {};
        }
        labels[dataIdx][seriesIdx] = { text: text, value: rawValue(seriesIdx, dataIdx), hidden: false };

        // Calculate font size when it's set to be automatic
        if (hasAutoValueSize) {
          const { fontSize: calculatedSize, textMetrics } = calculateFontSizeWithMetrics(
            labels[dataIdx][seriesIdx].text,
            hSpace * (isXHorizontal ? BAR_FONT_SIZE_RATIO : 1) - (isXHorizontal ? 0 : labelOffset),
            vSpace * (isXHorizontal ? 1 : BAR_FONT_SIZE_RATIO) - (isXHorizontal ? labelOffset : 0),
            1
          );

          // Save text metrics
          labels[dataIdx][seriesIdx].textMetrics = textMetrics;

          // Retrieve the new font size and use it
          let autoFontSize = Math.round(Math.min(fontSize, VALUE_MAX_FONT_SIZE, calculatedSize));

          // Calculate the scaling factor for bouding boxes
          // Take into account the fact that calculateFontSize
          // uses 14px measurement so we need to adjust the scale factor
          scaleFactor = (autoFontSize / fontSize) * (autoFontSize / 14);

          // Update the end font-size
          fontSize = autoFontSize;
        } else {
          labels[dataIdx][seriesIdx].textMetrics = measureText(labels[dataIdx][seriesIdx].text, fontSize);
        }

        let middleShift = isXHorizontal ? 0 : -Math.round(MIDDLE_BASELINE_SHIFT * fontSize);
        let value = rawValue(seriesIdx, dataIdx);

        if (opts.negY?.[seriesIdx] && value != null) {
          value *= -1;
        }

        if (value != null) {
          // Calculate final co-ordinates for text position
          const x =
            u.bbox.left + (isXHorizontal ? lft + wid / 2 : value < 0 ? lft - labelOffset : lft + wid + labelOffset);
          let y =
            u.bbox.top +
            (isXHorizontal ? (value < 0 ? top + hgt + labelOffset : top - labelOffset) : top + hgt / 2 - middleShift);

          // Retrieve textMetrics with necessary default values
          // These _shouldn't_ be undefined at this point
          // but they _could_ be.
          const {
            textMetrics = {
              width: 1,
              actualBoundingBoxAscent: 1,
              actualBoundingBoxDescent: 1,
            },
          } = labels[dataIdx][seriesIdx];

          // Adjust bounding boxes based on text scale
          // factor and orientation (which changes the baseline)
          let xAdjust = 0,
            yAdjust = 0;

          if (isXHorizontal) {
            // Adjust for baseline which is "top" in this case
            xAdjust = (textMetrics.width * scaleFactor) / 2;

            // yAdjust only matters when the value isn't negative
            yAdjust =
              value > 0
                ? (textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent) * scaleFactor
                : 0;
          } else {
            // Adjust from the baseline which is "middle" in this case
            yAdjust = ((textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent) * scaleFactor) / 2;

            // Adjust for baseline being "right" in the x direction
            xAdjust = value < 0 ? textMetrics.width * scaleFactor : 0;
          }

          // Force label bounding box y position to not be negative
          if (y - yAdjust < 0) {
            y = yAdjust;
          }

          // Construct final bounding box for the label text
          labels[dataIdx][seriesIdx].x = x;
          labels[dataIdx][seriesIdx].y = y;
          labels[dataIdx][seriesIdx].bbox = {
            x: x - xAdjust,
            y: y - yAdjust,
            w: textMetrics.width * scaleFactor,
            h: (textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent) * scaleFactor,
          };
        }
      }
    },
  });

  const init = (u: uPlot) => {
    u.root.querySelectorAll<HTMLDivElement>('.u-cursor-pt').forEach((el) => {
      el.style.borderRadius = '0';

      if (opts.fullHighlight) {
        el.style.zIndex = '-1';
      }
    });
  };

  const cursor: uPlot.Cursor = {
    x: false,
    y: false,
    drag: {
      x: false,
      y: false,
    },
    dataIdx: (u, seriesIdx) => {
      if (seriesIdx === 0) {
        hovered.fill(null);
        hRect = null;

        let cx = u.cursor.left! * uPlot.pxRatio;
        let cy = u.cursor.top! * uPlot.pxRatio;

        qt.get(cx, cy, 1, 1, (o) => {
          if (pointWithin(cx, cy, o.x, o.y, o.x + o.w, o.y + o.h)) {
            hRect = hovered[0] = o;
            hovered[hRect.sidx] = hRect;

            hoverMulti &&
              findRects(qt, undefined, hRect.didx).forEach((r) => {
                hovered[r.sidx] = r;
              });
          }
        });
      }

      return hovered[seriesIdx]?.didx;
    },
    points: {
      fill: 'rgba(255,255,255,0.4)',
      bbox: (u, seriesIdx) => {
        let hRect2 = hovered[seriesIdx];
        let isHovered = hRect2 != null;

        return {
          left: isHovered ? hRect2!.x / uPlot.pxRatio : -10,
          top: isHovered ? hRect2!.y / uPlot.pxRatio : -10,
          width: isHovered ? hRect2!.w / uPlot.pxRatio : 0,
          height: isHovered ? hRect2!.h / uPlot.pxRatio : 0,
        };
      },
    },
    focus: {
      prox: 1e3,
      dist: (u, seriesIdx) => (hRect?.sidx === seriesIdx ? 0 : Infinity),
    },
  };

  // Build bars
  const drawClear = (u: uPlot) => {
    qt = qt || new Quadtree(0, 0, u.bbox.width, u.bbox.height);
    qt.clear();

    // clear the path cache to force drawBars() to rebuild new quadtree
    u.series.forEach((s) => {
      // @ts-ignore
      s._paths = null;
    });

    const nClusters = 2; // TODO for testing, remove
    const groupsPerCluster = [2,2];

    if (groupByField != "" && groupByField != undefined) {
      barsPctLayout = [null, ...distrClusteredStacked(u.data[0].length, u.data.length -1, nClusters, groupsPerCluster)];
    }else if (isStacked) {
      barsPctLayout = [null, ...distrOne(u.data[0].length, u.data.length - 1)];
    } else {
      barsPctLayout = [null, ...distrTwo(u.data[0].length, u.data.length - 1)];
    }

    if (useMappedColors) {
      barsColors = [null];

      // map per-bar colors
      for (let i = 1; i < u.data.length; i++) {
        let colors = (u.data[i] as Array<number | null>).map((value, valueIdx) => {
          if (value != null) {
            return getColor!(i, valueIdx, value);
          }

          return null;
        });

        barsColors.push({
          fill:
            fillOpacity < 1 ? colors.map((c) => (c != null ? colorManipulator.alpha(c, fillOpacity) : null)) : colors,
          stroke: colors,
        });
      }
    }

    labels = {};
    fontSize = opts.text?.valueSize ?? VALUE_MAX_FONT_SIZE;
    labelOffset = LABEL_OFFSET_MAX;
    vSpace = hSpace = Infinity;
  };

  // uPlot hook to draw the labels on the bar chart.
  const draw = (u: uPlot) => {
    if (showValue === VisibilityMode.Never || fontSize < VALUE_MIN_FONT_SIZE) {
      return;
    }

    u.ctx.save();
    u.ctx.fillStyle = theme.colors.text.primary;
    u.ctx.font = `${fontSize}px ${theme.typography.fontFamily}`;

    let curAlign: CanvasTextAlign | undefined = undefined,
      curBaseline: CanvasTextBaseline | undefined = undefined;

    for (const didx in labels) {
      // exclude first label from overlap testing
      let first = true;

      for (const sidx in labels[didx]) {
        const label = labels[didx][sidx];
        const { text, x = 0, y = 0 } = label;
        let { value } = label;

        if (opts.negY?.[sidx] && value != null) {
          value *= -1;
        }

        let align: CanvasTextAlign = isXHorizontal ? 'center' : value !== null && value < 0 ? 'right' : 'left';
        let baseline: CanvasTextBaseline = isXHorizontal
          ? value !== null && value < 0
            ? 'top'
            : 'alphabetic'
          : 'middle';

        if (align !== curAlign) {
          u.ctx.textAlign = curAlign = align;
        }

        if (baseline !== curBaseline) {
          u.ctx.textBaseline = curBaseline = baseline;
        }

        if (showValue === VisibilityMode.Always) {
          u.ctx.fillText(text, x, y);
        } else if (showValue === VisibilityMode.Auto) {
          let { bbox } = label;

          let intersectsLabel = false;

          if (bbox == null) {
            intersectsLabel = true;
            label.hidden = true;
          } else if (!first) {
            // Test for any collisions
            for (const subsidx in labels[didx]) {
              if (subsidx === sidx) {
                continue;
              }

              const label2 = labels[didx][subsidx];
              const { bbox: bbox2, hidden } = label2;

              if (!hidden && bbox2 && intersects(bbox, bbox2)) {
                intersectsLabel = true;
                label.hidden = true;
                break;
              }
            }
          }

          first = false;

          !intersectsLabel && u.ctx.fillText(text, x, y);
        }
      }
    }

    u.ctx.restore();
  };

  let alignedTotals: AlignedData | null = null;

  function prepData(frames: DataFrame[], stackingGroups: StackingGroup[]) {
    alignedTotals = null;
    return preparePlotData2(frames[0], stackingGroups, ({ totals }) => {
      alignedTotals = totals;
    });
  }

  return {
    cursor,
    // scale & axis opts
    xRange,
    xValues,
    xSplits,
    hFilter,

    barsBuilder,

    // hooks
    init,
    drawClear,
    draw,
    prepData,
  };
}
