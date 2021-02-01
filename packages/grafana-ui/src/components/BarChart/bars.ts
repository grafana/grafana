import uPlot, { Axis, Series, Cursor, BBox } from 'uplot';
import { Quadtree, Rect, pointWithin } from './quadtree';
import { distribute, SPACE_BETWEEN } from './distribute';

const pxRatio = devicePixelRatio;

const groupDistr = SPACE_BETWEEN;
const barDistr = SPACE_BETWEEN;

const font = Math.round(10 * pxRatio) + 'px Arial';

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

/**
 * @internal
 */
export interface BarsOptions {
  xOri: 1 | 0;
  xDir: 1 | -1;
  groupWidth: number;
  barWidth: number;
  formatValue?: (seriesIdx: number, value: any) => string;
  onHover?: (seriesIdx: number, valueIdx: any) => void;
  onLeave?: (seriesIdx: number, valueIdx: any) => void;
}

/**
 * @internal
 */
export function getConfig(opts: BarsOptions) {
  const { xOri: ori, xDir: dir, groupWidth, barWidth, formatValue, onHover, onLeave } = opts;

  let qt: Quadtree;

  const drawBars: Series.PathBuilder = (u, sidx, i0, i1) => {
    return uPlot.orient(
      u,
      sidx,
      (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim, moveTo, lineTo, rect) => {
        const fill = new Path2D();

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

            rect(fill, lft, top, barWid, barHgt);

            let x = ori === 0 ? Math.round(lft - xOff) : Math.round(top - yOff);
            let y = ori === 0 ? Math.round(top - yOff) : Math.round(lft - xOff);
            let w = ori === 0 ? barWid : barHgt;
            let h = ori === 0 ? barHgt : barWid;

            qt.add({ x, y, w, h, sidx: sidx, didx: ix });
          }
        });

        return {
          stroke: fill,
          fill,
        };
      }
    );
  };

  const drawPoints: Series.Points.Show =
    formatValue == null
      ? false
      : (u, sidx, i0, i1) => {
          u.ctx.font = font;
          u.ctx.fillStyle = 'white';

          uPlot.orient(
            u,
            sidx,
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
              rect
            ) => {
              let numGroups = dataX.length;
              let barsPerGroup = u.series.length - 1;

              const _dir = dir * (ori === 0 ? 1 : -1);

              walkTwo(groupWidth, barWidth, sidx - 1, numGroups, barsPerGroup, xDim, null, (ix, x0, wid) => {
                let lft = Math.round(xOff + (_dir === 1 ? x0 : xDim - x0 - wid));
                let barWid = Math.round(wid);

                // prettier-ignore
                if (dataY[ix] != null) {
                  let yPos = valToPosY(dataY[ix]!, scaleY, yDim, yOff);

                  /* eslint-disable no-multi-spaces */
                  let x = ori === 0 ? Math.round(lft + barWid / 2) : Math.round(yPos);
                  let y = ori === 0 ? Math.round(yPos)             : Math.round(lft + barWid / 2);

                  u.ctx.textAlign    = ori === 0 ? 'center' : dataY[ix]! >= 0 ? 'left' : 'right';
                  u.ctx.textBaseline = ori === 1 ? 'middle' : dataY[ix]! >= 0 ? 'bottom' : 'top';
                  /* eslint-enable */

                  u.ctx.fillText(formatValue(sidx, dataY[ix]), x, y);
                }
              });
            }
          );

          return false;
        };

  /*
    const yRange: Scale.Range = (u, dataMin, dataMax) => {
      // @ts-ignore
      let [min, max] = uPlot.rangeNum(0, dataMax, 0.05, true);
      return [0, max];
    };
  */

  const xSplits: Axis.Splits = (u: uPlot, axisIdx: number) => {
    const dim = ori === 0 ? u.bbox.width : u.bbox.height;
    const _dir = dir * (ori === 0 ? 1 : -1);

    let splits: number[] = [];

    distribute(u.data[0].length, groupWidth, groupDistr, null, (di, lftPct, widPct) => {
      let groupLftPx = (dim * lftPct) / pxRatio;
      let groupWidPx = (dim * widPct) / pxRatio;

      let groupCenterPx = groupLftPx + groupWidPx / 2;

      splits.push(u.posToVal(groupCenterPx, 'x'));
    });

    return _dir === 1 ? splits : splits.reverse();
  };

  // @ts-ignore
  const xValues: Axis.Values = (u) => u.data[0];

  let hovered: Rect | null = null;

  let barMark = document.createElement('div');
  barMark.classList.add('bar-mark');
  barMark.style.position = 'absolute';
  barMark.style.background = 'rgba(255,255,255,0.4)';

  // hide crosshair cursor & hover points
  const cursor: Cursor = {
    x: false,
    y: false,
    points: {
      show: false,
    },
  };

  // disable selection
  // uPlot types do not export the Select interface prior to 1.6.4
  const select: Partial<BBox> = {
    show: false,
  };

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
  const setCursor = (u: uPlot) => {
    let found: Rect | null = null;
    let cx = u.cursor.left! * pxRatio;
    let cy = u.cursor.top! * pxRatio;

    qt.get(cx, cy, 1, 1, (o) => {
      if (pointWithin(cx, cy, o.x, o.y, o.x + o.w, o.y + o.h)) {
        found = o;
      }
    });

    if (found) {
      // prettier-ignore
      if (found !== hovered) {
        /* eslint-disable no-multi-spaces */
        barMark.style.display = '';
        barMark.style.left   = found!.x / pxRatio + 'px';
        barMark.style.top    = found!.y / pxRatio + 'px';
        barMark.style.width  = found!.w / pxRatio + 'px';
        barMark.style.height = found!.h / pxRatio + 'px';
        hovered = found;
        /* eslint-enable */

        if (onHover != null) {
          onHover(hovered!.sidx, hovered!.didx);
        }
      }
    } else if (hovered != null) {
      if (onLeave != null) {
        onLeave(hovered!.sidx, hovered!.didx);
      }

      hovered = null;
      barMark.style.display = 'none';
    }
  };

  return {
    // cursor & select opts
    cursor,
    select,

    // scale & axis opts
    // yRange,
    xValues,
    xSplits,

    // pathbuilders
    drawBars,
    drawPoints,

    // hooks
    init,
    drawClear,
    setCursor,
  };
}
