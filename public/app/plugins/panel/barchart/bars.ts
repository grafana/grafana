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
      let val = u.data[seriesIdx][dataIdx];

      if (isXHorizontal) {
        vSpace = Math.min(vSpace, val! < 0 ? u.bbox.top + u.bbox.height - (top + hgt) : top - u.bbox.top);
        hSpace = wid;
      } else {
        vSpace = hgt;
        hSpace = Math.min(hSpace, val! < 0 ? lft - u.bbox.left : u.bbox.left + u.bbox.width - (lft + wid));
      }

      qt.add({ x: lft, y: top, w: wid, h: hgt, sidx: seriesIdx, didx: dataIdx });
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
    vSpace = hSpace = Infinity;
  };

  // Collect label sizings
  const drawPoints = (u: uPlot, sidx: number) => {
    const textAlign = isXHorizontal ? 'center' : 'left';
    let textBaseline;
    uPlot.orient(u, sidx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
      const _dir = dir * (isXHorizontal ? 1 : -1);
      const wid = Math.round(barsPctLayout[sidx]!.size[0] * xDim);
      let y0Pos = valToPosY(0, scaleY, yDim, yOff);

      barsPctLayout[sidx]!.offs.forEach((offs, ix) => {
        const value = dataY[ix];

        if (value != null) {
          const valueOffset = value < 0 ? LABEL_OFFSET : -LABEL_OFFSET;
          let x0 = xDim * offs;
          let lft = Math.round(xOff + (_dir === ScaleDirection.Up ? x0 : xDim - x0 - wid));
          let yPos = valToPosY(value, scaleY, yDim, yOff);
          let btm = Math.round(Math.max(yPos, y0Pos));
          let top = Math.round(Math.min(yPos, y0Pos));
          let barWid = Math.round(wid);
          let barHgt = btm - top;

          let x = isXHorizontal ? Math.round(lft + barWid / 2) : Math.round(yPos);
          let y = isXHorizontal ? Math.round(yPos) : Math.round(lft + barWid / 2);

          let width = isXHorizontal ? barWid : barHgt;
          let height = isXHorizontal ? barHgt : barWid;

          let availableSpaceForText;
          if (isXHorizontal) {
            availableSpaceForText =
              -LABEL_OFFSET + (value! >= 0 ? y - u.bbox.top : u.bbox.top + u.bbox.height - y) / devicePixelRatio;
          } else {
            availableSpaceForText =
              -LABEL_OFFSET + (value! >= 0 ? u.bbox!.width - x + u.bbox.left : x - u.bbox.left) / devicePixelRatio;
          }

          const formattedValue = formatValue(sidx, value);

          if (hasAutoValueSize) {
            const size = isXHorizontal
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

          if (isXHorizontal) {
            if (value < 0) {
              textBaseline = 'top';
            } else {
              textBaseline = 'alphabetic';
            }
          } else {
            textBaseline = 'alphabetic';
          }

          // Collect labels szes
          labelsSizing.push({
            value,
            barWidth: width,
            barHeight: height,
            textBaseline: textBaseline as CanvasTextBaseline,
            x: !isXHorizontal ? x - valueOffset * devicePixelRatio : x, // canvas px
            y: isXHorizontal ? y + valueOffset * devicePixelRatio : y, // canvas px
            availableSpaceForText, // in css px
            formattedValue,
            textAlign,
          });
        }
      });
    });
    return undefined;
  };

  // uPlot hook to draw the labels on the bar chart.
  // Uses label sizings collected in drawClear hook.
  const draw = (u: uPlot) => {
    let shouldSkipLabelsRendering = false;
    let minFontSize = fontSize < VALUE_MIN_FONT_SIZE ? VALUE_MIN_FONT_SIZE : fontSize;
    const textMeasurements = [];

    if (showValue === BarValueVisibility.Never) {
      return false;
    }

    // collect final text measurements
    for (let i = 0; i < labelsSizing.length; i++) {
      const label = labelsSizing[i];
      const textMeasurement = measureText(label.formattedValue, minFontSize * devicePixelRatio);
      let actualLineHeight = textMeasurement.actualBoundingBoxAscent + textMeasurement.actualBoundingBoxDescent;
      textMeasurements.push(textMeasurement);

      // in Auto value mode skip rendering if any of the label has no sufficient space available
      if (showValue === BarValueVisibility.Auto) {
        if (isXHorizontal) {
          if (
            actualLineHeight > label.availableSpaceForText * devicePixelRatio ||
            textMeasurement.width > label.barWidth
          ) {
            shouldSkipLabelsRendering = true;
            break;
          }
        } else {
          if (
            textMeasurement.width / devicePixelRatio > label.availableSpaceForText ||
            actualLineHeight > label.barHeight
          ) {
            shouldSkipLabelsRendering = true;
            break;
          }
        }
      }
    }

    if (shouldSkipLabelsRendering) {
      return false;
    }

    // render labels
    for (let i = 0; i < labelsSizing.length; i++) {
      const label = labelsSizing[i];
      if (!label.value) {
        continue;
      }

      const textMeasurement = textMeasurements[i];
      let actualLineHeight = textMeasurement.actualBoundingBoxAscent + textMeasurement.actualBoundingBoxDescent;
      let textXPos = label.x;

      if (!isXHorizontal && label.value < 0) {
        textXPos = label.x - textMeasurements[i].width;
      }

      u.ctx.fillStyle = theme.colors.text.primary;
      u.ctx.font = `${minFontSize * devicePixelRatio}px ${theme.typography.fontFamily}`;
      u.ctx.textAlign = label.textAlign;
      u.ctx.textBaseline = label.textBaseline;
      u.ctx.fillText(label.formattedValue, textXPos, isXHorizontal ? label.y : label.y + actualLineHeight / 2);

      // Sizing debug - will probably be useful in the future :)
      // u.ctx.beginPath();
      // u.ctx.strokeStyle = '#00ff00';
      // if (isXHorizontal) {
      //   u.ctx.moveTo(u.bbox.left, label.y);
      //   u.ctx.lineTo(u.bbox.left + u.bbox.width, label.y);
      // } else {
      //   u.ctx.moveTo(u.bbox.left, label.y - actualLineHeight / 2);
      //   u.ctx.lineTo(u.bbox.left + u.bbox.width, label.y - actualLineHeight / 2);
      // }
      // u.ctx.closePath();
      // u.ctx.stroke();
      //
      // u.ctx.beginPath();
      // u.ctx.strokeStyle = '#00ff00';
      //
      // if (isXHorizontal) {
      //   u.ctx.moveTo(u.bbox.left, label.y + (label.value < 0 ? actualLineHeight : -actualLineHeight));
      //   u.ctx.lineTo(u.bbox.left + u.bbox.width, label.y + (label.value < 0 ? actualLineHeight : -actualLineHeight));
      // } else {
      //   u.ctx.moveTo(u.bbox.left, label.y + actualLineHeight / 2);
      //   u.ctx.lineTo(u.bbox.left + u.bbox.width, label.y + actualLineHeight / 2);
      // }
      // u.ctx.closePath();
      // u.ctx.stroke();

      // if (isXHorizontal) {
      //   if (label.value < 0) {
      //     u.ctx.beginPath();
      //     u.ctx.strokeStyle = '#ffff00';
      //     u.ctx.moveTo(label.x, label.y);
      //     u.ctx.lineTo(label.x, label.y + label.availableSpaceForText * devicePixelRatio);
      //     u.ctx.lineTo(label.x + 20, label.y + label.availableSpaceForText * devicePixelRatio);
      //     u.ctx.stroke();
      //   } else {
      //     u.ctx.beginPath();
      //     u.ctx.strokeStyle = '#ffff00';
      //     u.ctx.moveTo(label.x, label.y);
      //     u.ctx.lineTo(label.x, label.y - label.availableSpaceForText * devicePixelRatio);
      //     u.ctx.lineTo(label.x - 20, label.y - label.availableSpaceForText * devicePixelRatio);
      //     u.ctx.stroke();
      //   }
      // } else {
      //   if (label.value < 0) {
      //     u.ctx.beginPath();
      //     u.ctx.strokeStyle = '#ffff00';
      //     u.ctx.moveTo(label.x, label.y);
      //     u.ctx.lineTo(label.x - label.availableSpaceForText * devicePixelRatio, label.y);
      //     u.ctx.lineTo(label.x - label.availableSpaceForText * devicePixelRatio, label.y - 20);
      //     u.ctx.stroke();
      //   } else {
      //     u.ctx.beginPath();
      //     u.ctx.strokeStyle = '#ffff00';
      //     u.ctx.moveTo(label.x, label.y);
      //     u.ctx.lineTo(label.x + label.availableSpaceForText * devicePixelRatio, label.y);
      //     u.ctx.lineTo(label.x + label.availableSpaceForText * devicePixelRatio, label.y - 20);
      //     u.ctx.stroke();
      //   }
      // }
    }

    return false;
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
