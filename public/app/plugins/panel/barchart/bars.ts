import uPlot, { Axis } from 'uplot';
import { pointWithin, Quadtree, Rect } from './quadtree';
import { distribute, SPACE_BETWEEN } from './distribute';
import { BarValueVisibility, ScaleDirection, ScaleOrientation } from '@grafana/ui/src/components/uPlot/config';
import { CartesianCoords2D, GrafanaTheme2 } from '@grafana/data';
import { calculateFontSize, measureText, PlotTooltipInterpolator, VizTextDisplayOptions } from '@grafana/ui';

const groupDistr = SPACE_BETWEEN;
const barDistr = SPACE_BETWEEN;
// min.max font size for value label
const VALUE_MIN_FONT_SIZE = 8;
const VALUE_MAX_FONT_SIZE = 30;
// % of width/height of the bar that value should fit in when measuring size
const BAR_FONT_SIZE_RATIO = 0.65;
// distance between label and a bar
const LABEL_OFFSET = 5;

/**
 * @internal
 */
export interface BarsOptions {
  xOri: ScaleOrientation;
  xDir: ScaleDirection;
  groupWidth: number;
  barWidth: number;
  showValue: BarValueVisibility;
  formatValue: (seriesIdx: number, value: any) => string;
  text?: VizTextDisplayOptions;
  onHover?: (seriesIdx: number, valueIdx: number) => void;
  onLeave?: (seriesIdx: number, valueIdx: number) => void;
}

interface LabelDescriptor extends CartesianCoords2D {
  formattedValue: string;
  value: number | null;
  availableSpaceForText: number;
  barWidth: number;
  barHeight: number;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
}

/**
 * @internal
 */
export function getConfig(opts: BarsOptions, theme: GrafanaTheme2) {
  const { xOri, xDir: dir, groupWidth, barWidth, formatValue, showValue } = opts;
  const isXHorizontal = xOri === ScaleOrientation.Horizontal;
  const hasAutoValueSize = !Boolean(opts.text?.valueSize);
  let fontSize = opts.text?.valueSize ?? VALUE_MAX_FONT_SIZE;

  let qt: Quadtree;
  let labelsSizing: LabelDescriptor[] = [];
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
    each: (u, seriesIdx, dataIdx, lft, top, wid, hgt) => {
      // collect bar geometry

      let val = u.data[seriesIdx][dataIdx]!;

      // accum min space abvailable for labels
      if (isXHorizontal) {
        vSpace = Math.min(vSpace, val < 0 ? u.bbox.top + u.bbox.height - (top + hgt) : top - u.bbox.top);
        hSpace = wid;
      } else {
        vSpace = hgt;
        hSpace = Math.min(hSpace, val < 0 ? lft - u.bbox.left : u.bbox.left + u.bbox.width - (lft + wid));
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

    labelsSizing = [];

    // clear the path cache to force drawBars() to rebuild new quadtree
    u.series.forEach((s) => {
      // @ts-ignore
      s._paths = null;
    });

    barsPctLayout = ([null] as any).concat(distrTwo(u.data[0].length, u.data.length - 1));
    barRects.length = 0;
    vSpace = hSpace = Infinity;
  };

  // Collect label sizings
  const drawPoints = (u: uPlot, sidx: number) => {};

  // uPlot hook to draw the labels on the bar chart.
  // Uses label sizings collected in drawClear hook.
  const draw = (u: uPlot) => {
    u.ctx.fillStyle = theme.colors.text.primary;

    barRects.forEach((r) => {
      let value = u.data[r.sidx][r.didx];
      let text = formatValue(r.sidx, value);

      if (hasAutoValueSize) {
        const size = calculateFontSize(
          text,
          hSpace * (isXHorizontal ? BAR_FONT_SIZE_RATIO : 1) - (isXHorizontal ? 0 : LABEL_OFFSET),
          vSpace * (isXHorizontal ? 1 : BAR_FONT_SIZE_RATIO) - (isXHorizontal ? LABEL_OFFSET : 0),
          1
        );

        if (size <= fontSize) {
          fontSize = Math.round(size);
        }
      }

      u.ctx.textAlign = isXHorizontal ? 'center' : value < 0 ? 'right' : 'left';
      u.ctx.textBaseline = isXHorizontal ? (value < 0 ? 'top' : 'bottom') : 'middle';

      let minFontSize = fontSize < VALUE_MIN_FONT_SIZE ? VALUE_MIN_FONT_SIZE : fontSize;
      u.ctx.font = `${minFontSize * devicePixelRatio}px ${theme.typography.fontFamily}`;

      u.ctx.fillText(
        text,
        u.bbox.left + (isXHorizontal ? r.x + r.w / 2 : value < 0 ? r.x - LABEL_OFFSET : r.x + r.w + LABEL_OFFSET),
        u.bbox.top + (isXHorizontal ? (value < 0 ? r.y + r.h + LABEL_OFFSET : r.y - LABEL_OFFSET) : r.y + r.h / 2)
      );
    });

    return undefined;
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
    drawPoints,
    draw,
    interpolateTooltip,
  };
}
