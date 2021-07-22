import uPlot, { Axis } from 'uplot';
import { pointWithin, Quadtree, Rect } from './quadtree';
import { distribute, SPACE_BETWEEN } from './distribute';
import { GrafanaTheme2 } from '@grafana/data';
import {
  calculateFontSize,
  PlotTooltipInterpolator,
  VizTextDisplayOptions,
  StackingMode,
  BarValueVisibility,
  ScaleDirection,
  ScaleOrientation,
} from '@grafana/ui';

const groupDistr = SPACE_BETWEEN;
const barDistr = SPACE_BETWEEN;
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
  barWidth: number;
  showValue: BarValueVisibility;
  stacking: StackingMode;
  rawValue: (seriesIdx: number, valueIdx: number) => number | null;
  formatValue: (seriesIdx: number, value: any) => string;
  text?: VizTextDisplayOptions;
  onHover?: (seriesIdx: number, valueIdx: number) => void;
  onLeave?: (seriesIdx: number, valueIdx: number) => void;
}

/**
 * @internal
 */
export function getConfig(opts: BarsOptions, theme: GrafanaTheme2) {
  const { xOri, xDir: dir, groupWidth, barWidth, rawValue, formatValue, showValue } = opts;
  const isXHorizontal = xOri === ScaleOrientation.Horizontal;
  const hasAutoValueSize = !Boolean(opts.text?.valueSize);
  const isStacked = opts.stacking !== StackingMode.None;

  let qt: Quadtree;
  let hovered: Rect | undefined = undefined;

  let barMark = document.createElement('div');
  barMark.classList.add('bar-mark');
  barMark.style.position = 'absolute';
  barMark.style.background = 'rgba(255,255,255,0.4)';

  const xSplits: Axis.Splits = (u: uPlot) => {
    const dim = isXHorizontal ? u.bbox.width : u.bbox.height;
    const _dir = dir * (isXHorizontal ? 1 : -1);

    let splits: number[] = [];

    distribute(u.data[0].length, groupWidth, groupDistr, null, (di, leftPct, widPct) => {
      let groupLftPx = (dim * leftPct) / devicePixelRatio;
      let groupWidPx = (dim * widPct) / devicePixelRatio;

      let groupCenterPx = groupLftPx + groupWidPx / 2;

      splits.push(u.posToVal(groupCenterPx, 'x'));
    });

    return _dir === 1 ? splits : splits.reverse();
  };

  const xValues: Axis.Values = (u) => u.data[0].map((x) => formatValue(0, x));

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

  let barsPctLayout: Array<null | { offs: number[]; size: number[] }> = [];
  let barRects: Rect[] = [];

  // minimum available space for labels between bar end and plotting area bound (in canvas pixels)
  let vSpace = Infinity;
  let hSpace = Infinity;

  let barsBuilder = uPlot.paths.bars!({
    disp: {
      x0: {
        unit: 2,
        values: (u, seriesIdx) => barsPctLayout[seriesIdx]!.offs,
      },
      size: {
        unit: 2,
        values: (u, seriesIdx) => barsPctLayout[seriesIdx]!.size,
      },
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
      qt.add(barRect);
      barRects.push(barRect);
    },
  });

  const init = (u: uPlot) => {
    let over = u.over;
    over.style.overflow = 'hidden';
    over.appendChild(barMark);
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

    if (isStacked) {
      //barsPctLayout = [null as any].concat(distrOne(u.data.length - 1, u.data[0].length));
      barsPctLayout = [null as any].concat(distrOne(u.data[0].length, u.data.length - 1));
    } else {
      barsPctLayout = [null as any].concat(distrTwo(u.data[0].length, u.data.length - 1));
    }
    barRects.length = 0;
    vSpace = hSpace = Infinity;
  };

  const LABEL_OFFSET_FACTOR = isXHorizontal ? LABEL_OFFSET_FACTOR_VT : LABEL_OFFSET_FACTOR_HZ;
  const LABEL_OFFSET_MAX = isXHorizontal ? LABEL_OFFSET_MAX_VT : LABEL_OFFSET_MAX_HZ;

  // uPlot hook to draw the labels on the bar chart.
  const draw = (u: uPlot) => {
    if (showValue === BarValueVisibility.Never) {
      return;
    }
    // pre-cache formatted labels
    let texts = Array(barRects.length);
    let labelOffset = LABEL_OFFSET_MAX;

    barRects.forEach((r, i) => {
      texts[i] = formatValue(r.sidx, rawValue(r.sidx, r.didx));
      labelOffset = Math.min(labelOffset, Math.round(LABEL_OFFSET_FACTOR * (isXHorizontal ? r.w : r.h)));
    });

    let fontSize = opts.text?.valueSize ?? VALUE_MAX_FONT_SIZE;

    if (hasAutoValueSize) {
      for (let i = 0; i < barRects.length; i++) {
        fontSize = Math.round(
          Math.min(
            fontSize,
            VALUE_MAX_FONT_SIZE,
            calculateFontSize(
              texts[i],
              hSpace * (isXHorizontal ? BAR_FONT_SIZE_RATIO : 1) - (isXHorizontal ? 0 : labelOffset),
              vSpace * (isXHorizontal ? 1 : BAR_FONT_SIZE_RATIO) - (isXHorizontal ? labelOffset : 0),
              1
            )
          )
        );

        if (fontSize < VALUE_MIN_FONT_SIZE && showValue !== BarValueVisibility.Always) {
          return;
        }
      }
    }

    u.ctx.fillStyle = theme.colors.text.primary;
    u.ctx.font = `${fontSize}px ${theme.typography.fontFamily}`;

    let middleShift = isXHorizontal ? 0 : -Math.round(MIDDLE_BASELINE_SHIFT * fontSize);

    let curAlign: CanvasTextAlign, curBaseline: CanvasTextBaseline;

    barRects.forEach((r, i) => {
      let value = rawValue(r.sidx, r.didx);
      let text = texts[i];

      if (value != null) {
        let align: CanvasTextAlign = isXHorizontal ? 'center' : value < 0 ? 'right' : 'left';
        let baseline: CanvasTextBaseline = isXHorizontal ? (value < 0 ? 'top' : 'alphabetic') : 'middle';

        if (align !== curAlign) {
          u.ctx.textAlign = curAlign = align;
        }

        if (baseline !== curBaseline) {
          u.ctx.textBaseline = curBaseline = baseline;
        }

        u.ctx.fillText(
          text,
          u.bbox.left + (isXHorizontal ? r.x + r.w / 2 : value < 0 ? r.x - labelOffset : r.x + r.w + labelOffset),
          u.bbox.top +
            (isXHorizontal ? (value < 0 ? r.y + r.h + labelOffset : r.y - labelOffset) : r.y + r.h / 2 - middleShift)
        );
      }
    });
  };

  // handle hover interaction with quadtree probing
  const interpolateTooltip: PlotTooltipInterpolator = (
    updateActiveSeriesIdx,
    updateActiveDatapointIdx,
    updateTooltipPosition
  ) => {
    return (u: uPlot) => {
      let found: Rect | undefined;
      let cx = u.cursor.left! * devicePixelRatio;
      let cy = u.cursor.top! * devicePixelRatio;

      qt.get(cx, cy, 1, 1, (o) => {
        if (pointWithin(cx, cy, o.x, o.y, o.x + o.w, o.y + o.h)) {
          found = o;
        }
      });

      if (found) {
        // prettier-ignore
        if (found !== hovered) {
          barMark.style.display = '';
          barMark.style.left   = found.x / devicePixelRatio + 'px';
          barMark.style.top    = found.y / devicePixelRatio + 'px';
          barMark.style.width  = found.w / devicePixelRatio + 'px';
          barMark.style.height = found.h / devicePixelRatio + 'px';
          hovered = found;
          updateActiveSeriesIdx(hovered.sidx);
          updateActiveDatapointIdx(hovered.didx);
          updateTooltipPosition();
        }
      } else if (hovered !== undefined) {
        updateActiveSeriesIdx(hovered!.sidx);
        updateActiveDatapointIdx(hovered!.didx);
        updateTooltipPosition();
        hovered = undefined;
        barMark.style.display = 'none';
      } else {
        updateTooltipPosition(true);
      }
    };
  };

  return {
    cursor: {
      x: false,
      y: false,
    },
    // scale & axis opts
    xValues,
    xSplits,

    barsBuilder,

    // hooks
    init,
    drawClear,
    draw,
    interpolateTooltip,
  };
}
