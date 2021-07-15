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
// distance between label and a horizontal bar
const HORIZONTAL_BAR_LABEL_OFFSET = 10;
const LABEL_OFFSET = 10;

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
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
}

/**
 * @internal
 */
export function getConfig(opts: BarsOptions, theme: GrafanaTheme2) {
  const { xOri: ori, xDir: dir, groupWidth, barWidth, formatValue, showValue } = opts;
  const hasAutoValueSize = !Boolean(opts.text?.valueSize);
  let shouldSkipLabelsRendering = showValue === BarValueVisibility.Never;
  let fontSize = opts.text?.valueSize ?? VALUE_MAX_FONT_SIZE;
  const textAlign = ori === ScaleOrientation.Horizontal ? 'center' : 'left';
  const textBaseline = (ori === ScaleOrientation.Horizontal ? 'bottom' : 'middle') as CanvasTextBaseline;

  let qt: Quadtree;
  let labelsSizing: LabelDescriptor[] = [];

  // uPlot hook to draw the labels on the bar chart
  const draw = (u: uPlot) => {
    let minFontSize = fontSize < VALUE_MIN_FONT_SIZE ? VALUE_MIN_FONT_SIZE : fontSize;

    // const textMeasurement = measureText(formattedValue, fontSize * devicePixelRatio);
    // let actualLineHeight = textMeasurement.actualBoundingBoxAscent + textMeasurement.actualBoundingBoxDescent;

    // if (showValue === BarValueVisibility.Auto) {
    //   if (ori === ScaleOrientation.Horizontal) {
    //     if (actualLineHeight > availableSpaceForText || textMeasurement.width > width) {
    //       shouldSkipLabelsRendering = true;
    //     }
    //   }
    //
    //   if (ori === ScaleOrientation.Vertical) {
    //     if (
    //       textMeasurement.width / devicePixelRatio > availableSpaceForText ||
    //       actualLineHeight > height / devicePixelRatio
    //     ) {
    //       console.log('wider');
    //       shouldSkipLabelsRendering = true;
    //     }
    //   }
    // }
    for (let i = 0; i < labelsSizing.length; i++) {
      const label = labelsSizing[i];

      if (shouldSkipLabelsRendering) {
        return;
      }
      u.ctx.fillStyle = theme.colors.text.primary;
      u.ctx.font = `${minFontSize * devicePixelRatio}px ${theme.typography.fontFamily}`;
      u.ctx.textAlign = label.textAlign;
      u.ctx.textBaseline = label.textBaseline;
      u.ctx.fillText(label.formattedValue, label.x, label.y);
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

  let hovered: Rect | undefined = undefined;

  const xValues: Axis.Values = (u) => u.data[0].map((x) => formatValue(0, x));

  let barMark = document.createElement('div');
  barMark.classList.add('bar-mark');
  barMark.style.position = 'absolute';
  barMark.style.background = 'rgba(255,255,255,0.4)';

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

  let barsPctLayout: Array<{ offs: number[]; size: number[] }> = [];

  let barsBuilder = uPlot.paths.bars!({
    disp: {
      x0: {
        unit: 2,
        values: (u, seriesIdx, idx0, idx1) => barsPctLayout[seriesIdx].offs,
      },
      size: {
        unit: 2,
        values: (u, seriesIdx, idx0, idx1) => barsPctLayout[seriesIdx].size,
      },
    },
    each: (u, seriesIdx, dataIdx, lft, top, wid, hgt) => {
      qt.add({ x: lft, y: top, w: wid, h: hgt, sidx: seriesIdx, didx: dataIdx });
    },
  });

  const drawPoints = (u: uPlot, sidx: number, i0: number, i1: number) => {
    uPlot.orient(
      u,
      sidx,
      (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim, moveTo, lineTo, rect) => {
        const _dir = dir * (ori === ScaleOrientation.Horizontal ? 1 : -1);
        const wid = Math.round(barsPctLayout[sidx].size[0] * xDim);
        let y0Pos = valToPosY(0, scaleY, yDim, yOff);

        barsPctLayout[sidx].offs.forEach((offs, ix) => {
          if (dataY[ix] != null) {
            let x0 = xDim * offs;
            let lft = Math.round(xOff + (_dir === ScaleDirection.Up ? x0 : xDim - x0 - wid));
            let yPos = valToPosY(dataY[ix]!, scaleY, yDim, yOff);
            let btm = Math.round(Math.max(yPos, y0Pos));
            let top = Math.round(Math.min(yPos, y0Pos));
            let barWid = Math.round(wid);
            let barHgt = btm - top;

            let x = ori === ScaleOrientation.Horizontal ? Math.round(lft + barWid / 2) : Math.round(yPos);
            let y = ori === ScaleOrientation.Horizontal ? Math.round(yPos) : Math.round(lft + barWid / 2);

            let width = ori === ScaleOrientation.Horizontal ? barWid : barHgt;
            let height = ori === ScaleOrientation.Horizontal ? barHgt : barWid;

            let availableSpaceForText;
            if (ori === ScaleOrientation.Horizontal) {
              availableSpaceForText =
                (dataY[ix]! >= 0 ? y - u.bbox.top : u.bbox.top + u.bbox.height - y) / devicePixelRatio;
            } else {
              availableSpaceForText =
                (dataY[ix]! >= 0 ? u.bbox!.width - x + u.bbox.left : x - u.bbox.left) / devicePixelRatio;
            }

            // availableSpaceForText -= LABEL_OFFSET;

            const formattedValue = formatValue(sidx, dataY[ix]);

            if (hasAutoValueSize) {
              const size =
                ori === ScaleOrientation.Horizontal
                  ? calculateFontSize(
                      formattedValue,
                      (width / devicePixelRatio) * BAR_FONT_SIZE_RATIO,
                      availableSpaceForText * BAR_FONT_SIZE_RATIO,
                      1
                    )
                  : calculateFontSize(
                      formattedValue,
                      availableSpaceForText,
                      (height * BAR_FONT_SIZE_RATIO) / devicePixelRatio,
                      1
                    );
              if (size <= fontSize) {
                fontSize = Math.round(size);
              }
            }

            const textMeasurement = measureText(formattedValue, fontSize * devicePixelRatio);
            let actualLineHeight = textMeasurement.actualBoundingBoxAscent + textMeasurement.actualBoundingBoxDescent;

            console.log(textMeasurement);
            // fontBoundingBoxAscent is only supported in chrome & safari at the moment. (see: https://caniuse.com/?search=fontBoundingBoxAscent)
            // @ts-ignore
            // if (textMeasurement.fontBoundingBoxAscent && textMeasurement.fontBoundingBoxDescent) {
            // @ts-ignore
            // actualLineHeight = textMeasurement.fontBoundingBoxAscent + textMeasurement.fontBoundingBoxDescent;
            // }

            const yOffset = dataY[ix] !== null && dataY[ix] < 0 ? actualLineHeight * 2 + LABEL_OFFSET : -LABEL_OFFSET;
            const xOffset = dataY[ix] !== null && dataY[ix] < 0 ? textMeasurement.width + LABEL_OFFSET : -LABEL_OFFSET;

            // Collect labels szes
            labelsSizing.push({
              value: dataY[ix],
              barWidth: width,
              formattedValue,
              textAlign,
              textBaseline,
              availableSpaceForText,
              x: ori === ScaleOrientation.Vertical ? x - xOffset : x,
              y: ori === ScaleOrientation.Horizontal ? y + yOffset : y,
            });
          }
        });
      }
    );
    return undefined;
  };

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

    barsPctLayout = [null].concat(distrTwo(u.data[0].length, u.data.length - 1));
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
    // drawBars,
    draw,
    barsBuilder,
    drawPoints,

    // hooks
    init,
    drawClear,
    interpolateTooltip,
  };
}
