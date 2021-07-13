import uPlot, { Axis, Series } from 'uplot';
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
// distance between label and a horizontal bar
const HORIZONTAL_BAR_LABEL_OFFSET = 10;

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
  value: number;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fontSize: number;
  barWidth: number;
  barHeight: number;
  textWidth: number;
}

/**
 * @internal
 */
export function getConfig(opts: BarsOptions, theme: GrafanaTheme2) {
  const { xOri: ori, xDir: dir, groupWidth, barWidth, formatValue, showValue } = opts;
  const hasAutoValueSize = !Boolean(opts.text?.valueSize);

  let qt: Quadtree;
  let labelsSizing: Array<LabelDescriptor | null> = [];

  const drawBars: Series.PathBuilder = (u, sidx) => {
    return uPlot.orient(
      u,
      sidx,
      (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim, moveTo, lineTo, rect) => {
        const fill = new Path2D();
        const stroke = new Path2D();

        let numGroups = dataX.length;
        let barsPerGroup = u.series.length - 1;

        let y0Pos = valToPosY(0, scaleY, yDim, yOff);

        const _dir = dir * (ori === 0 ? 1 : -1);

        walkTwo(groupWidth, barWidth, sidx - 1, numGroups, barsPerGroup, xDim, null, (ix, x0, wid) => {
          let left = Math.round(xOff + (_dir === 1 ? x0 : xDim - x0 - wid));
          let barWid = Math.round(wid);
          const canvas = u.over;
          const bbox = canvas?.getBoundingClientRect();

          if (dataY[ix] != null) {
            let yPos = valToPosY(dataY[ix]!, scaleY, yDim, yOff);
            let btm = Math.round(Math.max(yPos, y0Pos));
            let top = Math.round(Math.min(yPos, y0Pos));
            let barHgt = btm - top;
            let strokeWidth = series.width || 0;

            if (strokeWidth) {
              rect(stroke, left + strokeWidth / 2, top + strokeWidth / 2, barWid - strokeWidth, barHgt - strokeWidth);
            }

            rect(fill, left, top, barWid, barHgt);

            let x = ori === ScaleOrientation.Horizontal ? Math.round(left - xOff) : Math.round(top - yOff);
            let y = ori === ScaleOrientation.Horizontal ? Math.round(top - yOff) : Math.round(left - xOff);
            let width = ori === ScaleOrientation.Horizontal ? barWid : barHgt;
            let height = ori === ScaleOrientation.Horizontal ? barHgt : barWid;

            qt.add({ x, y, w: width, h: height, sidx: sidx, didx: ix });

            // Collect labels sizes and placements
            const value = formatValue(sidx, dataY[ix]);
            let labelX = ori === ScaleOrientation.Horizontal ? Math.round(left) : Math.round(top);
            let labelY = ori === ScaleOrientation.Horizontal ? Math.round(top) : Math.round(left);

            let availableSpaceForText;

            if (ori === ScaleOrientation.Horizontal) {
              availableSpaceForText =
                dataY[ix]! >= 0 ? y / devicePixelRatio : bbox!.height - (y + height) / devicePixelRatio;
            } else {
              availableSpaceForText =
                dataY[ix]! >= 0 ? bbox!.width - (x + width) / devicePixelRatio : x / devicePixelRatio;
            }

            /**
             * Snippet below is for debugging the available space for text. Leaving it for the future bugs...
             */
            // u.ctx.beginPath();
            // u.ctx.strokeStyle = '#0000ff';

            // if (dataY[ix]! >= 0) {
            //   if (ori === ScaleOrientation.Horizontal) {
            //     u.ctx.moveTo(left, top - availableSpaceForText * devicePixelRatio);
            //     u.ctx.lineTo(left + width, top - availableSpaceForText * devicePixelRatio);
            //     u.ctx.lineTo(left + width, top);
            //     u.ctx.lineTo(left, top);
            //   } else {
            //     u.ctx.moveTo(top + width, left);
            //     u.ctx.lineTo(top + width + availableSpaceForText * devicePixelRatio, left);
            //     u.ctx.lineTo(top + width + availableSpaceForText * devicePixelRatio, left + height);
            //     u.ctx.lineTo(top + width, left + height);
            //   }
            // } else {
            //   if (ori === ScaleOrientation.Horizontal) {
            //     u.ctx.moveTo(left, top + height + availableSpaceForText * devicePixelRatio);
            //     u.ctx.lineTo(left + width, top + height + availableSpaceForText * devicePixelRatio);
            //     u.ctx.lineTo(left + width, top + height);
            //     u.ctx.lineTo(left, top + height);
            //   } else {
            //     u.ctx.moveTo(top, left);
            //     u.ctx.lineTo(top - availableSpaceForText * devicePixelRatio, left);
            //     u.ctx.lineTo(top - availableSpaceForText * devicePixelRatio, left + height);
            //     u.ctx.lineTo(top, left + height);
            //   }
            // }
            // u.ctx.closePath();
            // u.ctx.stroke();

            let fontSize = opts.text?.valueSize ?? VALUE_MIN_FONT_SIZE;

            if (hasAutoValueSize) {
              const size =
                ori === ScaleOrientation.Horizontal
                  ? calculateFontSize(
                      value,
                      (width / devicePixelRatio) * BAR_FONT_SIZE_RATIO,
                      availableSpaceForText * BAR_FONT_SIZE_RATIO,
                      1
                    )
                  : calculateFontSize(
                      value,
                      availableSpaceForText,
                      (height * BAR_FONT_SIZE_RATIO) / devicePixelRatio,
                      1
                    );
              fontSize = size > VALUE_MAX_FONT_SIZE ? VALUE_MAX_FONT_SIZE : size;
            }

            const textAlign = ori === ScaleOrientation.Horizontal ? 'center' : 'left';
            const textBaseline = (ori === ScaleOrientation.Horizontal ? 'bottom' : 'alphabetic') as CanvasTextBaseline;
            const textMeasurement = measureText(value, fontSize * devicePixelRatio);
            let labelPosition: CartesianCoords2D = { x: labelX, y: labelY };

            // Collect labels szes
            labelsSizing.push({
              formattedValue: value,
              value: dataY[ix]!,
              textAlign,
              textBaseline,
              fontSize: Math.floor(fontSize),
              barWidth: width,
              barHeight: height,
              textWidth: textMeasurement.width,
              ...labelPosition,
            });
          } else {
            labelsSizing.push(null);
          }
        });

        return {
          stroke,
          fill,
        };
      }
    );
  };

  // uPlot hook to draw the labels on the bar chart
  const draw = (u: uPlot) => {
    let minFontSize = labelsSizing.reduce((min, s) => (s && s.fontSize < min ? s.fontSize : min), Infinity);

    if (minFontSize === Infinity) {
      return;
    }

    for (let i = 0; i < labelsSizing.length; i++) {
      const label = labelsSizing[i];
      let x = 0,
        y = 0;
      if (label === null) {
        continue;
      }

      const fontSize = hasAutoValueSize ? minFontSize : label.fontSize;

      if (showValue === BarValueVisibility.Never) {
        return;
      }

      if (showValue !== BarValueVisibility.Always) {
        if (
          hasAutoValueSize &&
          ((ori === ScaleOrientation.Horizontal && label.textWidth > label.barWidth) ||
            minFontSize < VALUE_MIN_FONT_SIZE)
        ) {
          return;
        }
      }

      // Calculate final labels positions according to unified text size
      const textMeasurement = measureText(label.formattedValue, fontSize * devicePixelRatio);

      let actualLineHeight = textMeasurement.actualBoundingBoxAscent + textMeasurement.actualBoundingBoxDescent;

      // fontBoundingBoxAscent is only supported in chrome & safari at the moment. (see: https://caniuse.com/?search=fontBoundingBoxAscent)
      // @ts-ignore
      if (textMeasurement.fontBoundingBoxAscent && textMeasurement.fontBoundingBoxDescent) {
        // @ts-ignore
        actualLineHeight = textMeasurement.fontBoundingBoxAscent + textMeasurement.fontBoundingBoxDescent;
      }

      if (ori === ScaleOrientation.Horizontal) {
        x = label.x + label.barWidth / 2;
        y = label.y + (label.value >= 0 ? 0 : label.barHeight + actualLineHeight);
      } else {
        x =
          label.x +
          (label.value >= 0
            ? label.barWidth + HORIZONTAL_BAR_LABEL_OFFSET
            : -textMeasurement.width - HORIZONTAL_BAR_LABEL_OFFSET);
        y =
          label.y +
          (label.barHeight + textMeasurement.actualBoundingBoxAscent + textMeasurement.actualBoundingBoxDescent) / 2;
      }

      /**
       * Snippet below is for debugging the available space for text. Leaving it for the future bugs...
       */
      // u.ctx.beginPath();
      // u.ctx.fillStyle = '#0000ff';
      // u.ctx.arc(label.x, label.y, 10, 0, Math.PI * 2, true);
      // u.ctx.closePath();
      // u.ctx.fill();

      u.ctx.fillStyle = theme.colors.text.primary;
      u.ctx.font = `${fontSize * devicePixelRatio}px ${theme.typography.fontFamily}`;
      u.ctx.textAlign = label.textAlign;
      u.ctx.textBaseline = label.textBaseline;
      u.ctx.fillText(label.formattedValue, x, y);
    }

    return false;
  };

  const xSplits: Axis.Splits = (u: uPlot) => {
    const dim = ori === 0 ? u.bbox.width : u.bbox.height;
    const _dir = dir * (ori === 0 ? 1 : -1);

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

  let hovered: Rect | undefined = undefined;

  let barMark = document.createElement('div');
  barMark.classList.add('bar-mark');
  barMark.style.position = 'absolute';
  barMark.style.background = 'rgba(255,255,255,0.4)';

  const init = (u: uPlot) => {
    let over = u.over;
    over.style.overflow = 'hidden';
    over.appendChild(barMark);
  };

  const drawClear = (u: uPlot) => {
    qt = qt || new Quadtree(0, 0, u.bbox.width, u.bbox.height);

    qt.clear();

    labelsSizing = [];

    // clear the path cache to force drawBars() to rebuild new quadtree
    u.series.forEach((s) => {
      // @ts-ignore
      s._paths = null;
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

    // pathbuilders
    drawBars,
    draw,

    // hooks
    init,
    drawClear,
    interpolateTooltip,
  };
}

type WalkTwoCb = null | ((idx: number, offPx: number, dimPx: number) => void);

function walkTwo(
  groupWidth: number,
  barWidth: number,
  yIdx: number,
  xCount: number,
  yCount: number,
  xDim: number,
  xDraw?: WalkTwoCb,
  yDraw?: WalkTwoCb
) {
  distribute(xCount, groupWidth, groupDistr, null, (ix, offPct, dimPct) => {
    let groupOffPx = xDim * offPct;
    let groupWidPx = xDim * dimPct;

    xDraw && xDraw(ix, groupOffPx, groupWidPx);

    yDraw &&
      distribute(yCount, barWidth, barDistr, yIdx, (iy, offPct, dimPct) => {
        let barOffPx = groupWidPx * offPct;
        let barWidPx = groupWidPx * dimPct;

        yDraw(ix, groupOffPx + barOffPx, barWidPx);
      });
  });
}
