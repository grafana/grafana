import uPlot, { Axis, Series } from 'uplot';
import { pointWithin, Quadtree, Rect } from './quadtree';
import { distribute, SPACE_BETWEEN } from './distribute';
import { TooltipInterpolator } from '@grafana/ui/src/components/uPlot/types';
import { BarValueVisibility, ScaleDirection, ScaleOrientation } from '@grafana/ui/src/components/uPlot/config';
import { GrafanaTheme2 } from '@grafana/data';
import { calculateFontSize, measureText } from '@grafana/ui';
import { VizValueFormattingMode, VizValueFormattingOptions } from '@grafana/ui/src/options/builder';

const groupDistr = SPACE_BETWEEN;
const barDistr = SPACE_BETWEEN;

// Minimum font size for value label
const VALUE_MIN_FONT_SIZE = 10;
// % of width/height of the bar that value should fit in when measuring size
const BAR_FONT_SIZE_RATIO = 0.75;
// distance between label and a bar
const BAR_LABEL_OFFSET = 10;

/**
 * @internal
 */
export interface BarsOptions {
  xOri: ScaleOrientation;
  xDir: ScaleDirection;
  groupWidth: number;
  barWidth: number;
  valueFormatting: VizValueFormattingOptions;
  showValue: BarValueVisibility;
  formatValue?: (seriesIdx: number, value: any) => string;
  onHover?: (seriesIdx: number, valueIdx: number) => void;
  onLeave?: (seriesIdx: number, valueIdx: number) => void;
}

/**
 * @internal
 */
export function getConfig(opts: BarsOptions, theme: GrafanaTheme2) {
  const { xOri: ori, xDir: dir, groupWidth, barWidth, formatValue } = opts;

  let qt: Quadtree;

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
          let lft = Math.round(xOff + (_dir === 1 ? x0 : xDim - x0 - wid));
          let barWid = Math.round(wid);

          if (dataY[ix] != null) {
            let yPos = valToPosY(dataY[ix]!, scaleY, yDim, yOff);

            let btm = Math.round(Math.max(yPos, y0Pos));
            let top = Math.round(Math.min(yPos, y0Pos));
            let barHgt = btm - top;

            let strokeWidth = series.width || 0;

            if (strokeWidth) {
              rect(stroke, lft + strokeWidth / 2, top + strokeWidth / 2, barWid - strokeWidth, barHgt - strokeWidth);
            }

            rect(fill, lft, top, barWid, barHgt);

            let x = ori === 0 ? Math.round(lft - xOff) : Math.round(top - yOff);
            let y = ori === 0 ? Math.round(top - yOff) : Math.round(lft - xOff);
            let w = ori === 0 ? barWid : barHgt;
            let h = ori === 0 ? barHgt : barWid;

            qt.add({ x, y, w, h, sidx: sidx, didx: ix });
          }
        });

        return {
          stroke,
          fill,
        };
      }
    );
  };

  const drawPoints: Series.Points.Show =
    formatValue == null
      ? false
      : (u, sidx) => {
          u.ctx.fillStyle = theme.colors.text.primary;

          uPlot.orient(
            u,
            sidx,
            (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
              const canvas = u.root.querySelector<HTMLDivElement>('.u-over');
              const bbox = canvas?.getBoundingClientRect();
              let numGroups = dataX.length;
              let barsPerGroup = u.series.length - 1;
              const _dir = dir * (ori === 0 ? 1 : -1);

              walkTwo(groupWidth, barWidth, sidx - 1, numGroups, barsPerGroup, xDim, null, (ix, x0, wid) => {
                const value = formatValue(sidx, dataY[ix]);

                let lft = Math.round(xOff + (_dir === 1 ? x0 : xDim - x0 - wid));
                let barWid = Math.round(wid);

                if (dataY[ix] != null) {
                  let yPos = valToPosY(dataY[ix]!, scaleY, yDim, yOff);

                  let x = ori === 0 ? Math.round(lft + barWid / 2) : Math.round(yPos);
                  let y = ori === 0 ? Math.round(yPos) : Math.round(lft + barWid / 2);

                  let availableSpaceForText;

                  if (ori === ScaleOrientation.Horizontal) {
                    availableSpaceForText =
                      dataY[ix]! >= 0 ? y / devicePixelRatio : bbox!.height - y / devicePixelRatio;
                  } else {
                    availableSpaceForText =
                      dataY[ix]! >= 0
                        ? bbox!.width - x / devicePixelRatio
                        : x / devicePixelRatio - (u.width - bbox!.width);
                  }

                  let fontSize = opts.valueFormatting?.size ?? VALUE_MIN_FONT_SIZE;
                  let xOffset = 0;
                  let yOffset = 0;

                  if (ori === ScaleOrientation.Horizontal) {
                    yOffset = dataY[ix]! >= 0 ? -BAR_LABEL_OFFSET : BAR_LABEL_OFFSET;
                  } else {
                    xOffset = dataY[ix]! < 0 ? -BAR_LABEL_OFFSET : BAR_LABEL_OFFSET;
                  }

                  if (opts.valueFormatting?.mode === VizValueFormattingMode.Auto) {
                    const size =
                      ori === ScaleOrientation.Horizontal
                        ? calculateFontSize(
                            value,
                            (barWid / devicePixelRatio) * BAR_FONT_SIZE_RATIO,
                            availableSpaceForText * BAR_FONT_SIZE_RATIO - BAR_LABEL_OFFSET / devicePixelRatio,
                            1
                          )
                        : calculateFontSize(
                            value,
                            availableSpaceForText - (BAR_LABEL_OFFSET / devicePixelRatio) * BAR_FONT_SIZE_RATIO,
                            (barWid * BAR_FONT_SIZE_RATIO) / devicePixelRatio,
                            1
                          );
                    fontSize = Math.round(size);
                  }
                  const textWidth = measureText(value, fontSize).width;

                  // show label when it is forced or when it makes sense (fits into bar width or is readable)
                  if (
                    opts.showValue === BarValueVisibility.Always ||
                    fontSize >= VALUE_MIN_FONT_SIZE ||
                    textWidth < barWidth
                  ) {
                    const textAlign =
                      ori === ScaleOrientation.Horizontal ? 'center' : dataY[ix]! >= 0 ? 'left' : 'right';
                    const textBaseline =
                      ori === ScaleOrientation.Vertical ? 'middle' : dataY[ix]! >= 0 ? 'bottom' : 'top';

                    u.ctx.font = `${fontSize * devicePixelRatio}px ${theme.typography.fontFamily}`;
                    u.ctx.textAlign = textAlign;
                    u.ctx.textBaseline = textBaseline;
                    u.ctx.fillText(value, x + xOffset, y + yOffset);
                  }
                }
              });
            }
          );

          return false;
        };

  const xSplits: Axis.Splits = (u: uPlot) => {
    const dim = ori === 0 ? u.bbox.width : u.bbox.height;
    const _dir = dir * (ori === 0 ? 1 : -1);

    let splits: number[] = [];

    distribute(u.data[0].length, groupWidth, groupDistr, null, (di, lftPct, widPct) => {
      let groupLftPx = (dim * lftPct) / devicePixelRatio;
      let groupWidPx = (dim * widPct) / devicePixelRatio;

      let groupCenterPx = groupLftPx + groupWidPx / 2;

      splits.push(u.posToVal(groupCenterPx, 'x'));
    });

    return _dir === 1 ? splits : splits.reverse();
  };

  const xValues: Axis.Values = (u) => u.data[0];

  let hovered: Rect | null = null;

  let barMark = document.createElement('div');
  barMark.classList.add('bar-mark');
  barMark.style.position = 'absolute';
  barMark.style.background = 'rgba(255,255,255,0.4)';

  const init = (u: uPlot) => {
    let over = u.root.querySelector('.u-over')! as HTMLElement;
    over.style.overflow = 'hidden';
    over.appendChild(barMark);
  };

  const drawClear = (u: uPlot) => {
    qt = qt || new Quadtree(0, 0, u.bbox.width, u.bbox.height);

    qt.clear();

    // clear the path cache to force drawBars() to rebuild new quadtree
    u.series.forEach((s) => {
      // @ts-ignore
      s._paths = null;
    });
  };

  // handle hover interaction with quadtree probing
  const interpolateBarChartTooltip: TooltipInterpolator = (
    updateActiveSeriesIdx,
    updateActiveDatapointIdx,
    updateTooltipPosition
  ) => {
    return (u: uPlot) => {
      let found: Rect | null = null;
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
          barMark.style.left   = found!.x / devicePixelRatio + 'px';
          barMark.style.top    = found!.y / devicePixelRatio + 'px';
          barMark.style.width  = found!.w / devicePixelRatio + 'px';
          barMark.style.height = found!.h / devicePixelRatio + 'px';
          hovered = found;
          updateActiveSeriesIdx(hovered!.sidx);
          updateActiveDatapointIdx(hovered!.didx);
          updateTooltipPosition();
        }
      } else if (hovered != null) {
        updateActiveSeriesIdx(hovered!.sidx);
        updateActiveDatapointIdx(hovered!.didx);
        updateTooltipPosition();
        hovered = null;
        barMark.style.display = 'none';
      } else {
        updateTooltipPosition(true);
      }
    };
  };

  return {
    // scale & axis opts
    xValues,
    xSplits,

    // pathbuilders
    drawBars,
    drawPoints,

    // hooks
    init,
    drawClear,
    interpolateBarChartTooltip,
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
