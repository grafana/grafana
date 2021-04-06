import uPlot, { Series, Cursor } from 'uplot';
import { FIXED_UNIT } from '../GraphNG/GraphNG';
import { Quadtree, Rect, pointWithin } from '../BarChart/quadtree';
import { distribute, SPACE_BETWEEN } from '../BarChart/distribute';
import { TimelineMode } from './types';
import { TimeRange } from '@grafana/data';
import { BarValueVisibility } from '../BarChart/types';

const { round, min, ceil } = Math;

const pxRatio = devicePixelRatio;

const laneDistr = SPACE_BETWEEN;

const font = Math.round(10 * pxRatio) + 'px Roboto';

type WalkCb = (idx: number, offPx: number, dimPx: number) => void;

function walk(rowHeight: number, yIdx: number | null, count: number, dim: number, draw: WalkCb) {
  distribute(count, rowHeight, laneDistr, yIdx, (i, offPct, dimPct) => {
    let laneOffPx = dim * offPct;
    let laneWidPx = dim * dimPct;

    draw(i, laneOffPx, laneWidPx);
  });
}

/**
 * @internal
 */
export interface TimelineCoreOptions {
  mode: TimelineMode;
  numSeries: number;
  rowHeight: number;
  colWidth?: number;
  showValue: BarValueVisibility;
  isDiscrete: (seriesIdx: number) => boolean;

  label: (seriesIdx: number) => string;
  fill: (seriesIdx: number, valueIdx: number, value: any) => CanvasRenderingContext2D['fillStyle'];
  stroke: (seriesIdx: number, valueIdx: number, value: any) => CanvasRenderingContext2D['strokeStyle'];
  getTimeRange: () => TimeRange;
  formatValue?: (seriesIdx: number, value: any) => string;
  onHover?: (seriesIdx: number, valueIdx: number) => void;
  onLeave?: (seriesIdx: number, valueIdx: number) => void;
}

/**
 * @internal
 */
export function getConfig(opts: TimelineCoreOptions) {
  const {
    mode,
    numSeries,
    isDiscrete,
    rowHeight = 0,
    colWidth = 0,
    showValue,
    label,
    fill,
    stroke,
    formatValue,
    getTimeRange,
    // onHover,
    // onLeave,
  } = opts;

  let qt: Quadtree;

  const hoverMarks = Array(numSeries)
    .fill(null)
    .map(() => {
      let mark = document.createElement('div');
      mark.classList.add('bar-mark');
      mark.style.position = 'absolute';
      mark.style.background = 'rgba(255,255,255,0.4)';
      return mark;
    });

  const hovered: Array<Rect | null> = Array(numSeries).fill(null);

  const size = [colWidth, 100];
  const gapFactor = 1 - size[0];
  const maxWidth = (size[1] ?? Infinity) * pxRatio;

  const fillPaths: Map<CanvasRenderingContext2D['fillStyle'], Path2D> = new Map();
  const strokePaths: Map<CanvasRenderingContext2D['strokeStyle'], Path2D> = new Map();

  function drawBoxes(ctx: CanvasRenderingContext2D) {
    fillPaths.forEach((fillPath, fillStyle) => {
      ctx.fillStyle = fillStyle;
      ctx.fill(fillPath);
    });

    strokePaths.forEach((strokePath, strokeStyle) => {
      ctx.strokeStyle = strokeStyle;
      ctx.stroke(strokePath);
    });

    fillPaths.clear();
    strokePaths.clear();
  }

  function putBox(
    ctx: CanvasRenderingContext2D,
    rect: uPlot.RectH,
    xOff: number,
    yOff: number,
    lft: number,
    top: number,
    wid: number,
    hgt: number,
    strokeWidth: number,
    seriesIdx: number,
    valueIdx: number,
    value: any,
    discrete: boolean
  ) {
    if (discrete) {
      let fillStyle = fill(seriesIdx + 1, valueIdx, value);
      let fillPath = fillPaths.get(fillStyle);

      if (fillPath == null) {
        fillPaths.set(fillStyle, (fillPath = new Path2D()));
      }

      rect(fillPath, lft, top, wid, hgt);

      if (strokeWidth) {
        let strokeStyle = stroke(seriesIdx + 1, valueIdx, value);
        let strokePath = strokePaths.get(strokeStyle);

        if (strokePath == null) {
          strokePaths.set(strokeStyle, (strokePath = new Path2D()));
        }

        rect(strokePath, lft + strokeWidth / 2, top + strokeWidth / 2, wid - strokeWidth, hgt - strokeWidth);
      }
    } else {
      ctx.beginPath();
      rect(ctx, lft, top, wid, hgt);
      ctx.fillStyle = fill(seriesIdx, valueIdx, value);
      ctx.fill();

      if (strokeWidth) {
        ctx.beginPath();
        rect(ctx, lft + strokeWidth / 2, top + strokeWidth / 2, wid - strokeWidth, hgt - strokeWidth);
        ctx.strokeStyle = stroke(seriesIdx, valueIdx, value);
        ctx.stroke();
      }
    }

    qt.add({
      x: round(lft - xOff),
      y: round(top - yOff),
      w: wid,
      h: hgt,
      sidx: seriesIdx + 1,
      didx: valueIdx,
    });
  }

  const drawPaths: Series.PathBuilder = (u, sidx, idx0, idx1) => {
    uPlot.orient(
      u,
      sidx,
      (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim, moveTo, lineTo, rect) => {
        let strokeWidth = round((series.width || 0) * pxRatio);

        let discrete = isDiscrete(sidx);

        u.ctx.save();
        rect(u.ctx, u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
        u.ctx.clip();

        walk(rowHeight, sidx - 1, numSeries, yDim, (iy, y0, hgt) => {
          if (mode === TimelineMode.Spans) {
            for (let ix = 0; ix < dataY.length; ix++) {
              if (dataY[ix] != null) {
                let lft = Math.round(valToPosX(dataX[ix], scaleX, xDim, xOff));

                let nextIx = ix;
                while (dataY[++nextIx] === undefined && nextIx < dataY.length) {}

                // to now (not to end of chart)
                let rgt =
                  nextIx === dataY.length
                    ? xOff + xDim + strokeWidth
                    : Math.round(valToPosX(dataX[nextIx], scaleX, xDim, xOff));

                putBox(
                  u.ctx,
                  rect,
                  xOff,
                  yOff,
                  lft,
                  round(yOff + y0),
                  rgt - lft,
                  round(hgt),
                  strokeWidth,
                  iy,
                  ix,
                  dataY[ix],
                  discrete
                );

                ix = nextIx - 1;
              }
            }
          } else if (mode === TimelineMode.Grid) {
            let colWid = valToPosX(dataX[1], scaleX, xDim, xOff) - valToPosX(dataX[0], scaleX, xDim, xOff);
            let gapWid = colWid * gapFactor;
            let barWid = round(min(maxWidth, colWid - gapWid) - strokeWidth);
            let xShift = barWid / 2;
            //let xShift = align === 1 ? 0 : align === -1 ? barWid : barWid / 2;

            for (let ix = idx0; ix <= idx1; ix++) {
              if (dataY[ix] != null) {
                // TODO: all xPos can be pre-computed once for all series in aligned set
                let lft = valToPosX(dataX[ix], scaleX, xDim, xOff);

                putBox(
                  u.ctx,
                  rect,
                  xOff,
                  yOff,
                  round(lft - xShift),
                  round(yOff + y0),
                  barWid,
                  round(hgt),
                  strokeWidth,
                  iy,
                  ix,
                  dataY[ix],
                  discrete
                );
              }
            }
          }
        });

        discrete && drawBoxes(u.ctx);

        u.ctx.restore();
      }
    );

    return null;
  };

  const drawPoints: Series.Points.Show =
    formatValue == null || showValue === BarValueVisibility.Never
      ? false
      : (u, sidx, i0, i1) => {
          u.ctx.save();
          u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
          u.ctx.clip();

          u.ctx.font = font;
          u.ctx.fillStyle = 'black';
          u.ctx.textAlign = mode === TimelineMode.Spans ? 'left' : 'center';
          u.ctx.textBaseline = 'middle';

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
              let y = round(yOff + yMids[sidx - 1]);

              for (let ix = 0; ix < dataY.length; ix++) {
                if (dataY[ix] != null) {
                  let x = valToPosX(dataX[ix], scaleX, xDim, xOff);
                  u.ctx.fillText(formatValue(sidx, dataY[ix]), x, y);
                }
              }
            }
          );

          u.ctx.restore();

          return false;
        };

  const init = (u: uPlot) => {
    let over = u.root.querySelector('.u-over')! as HTMLElement;
    over.style.overflow = 'hidden';
    hoverMarks.forEach((m) => {
      over.appendChild(m);
    });
  };

  const drawClear = (u: uPlot) => {
    qt = qt || new Quadtree(0, 0, u.bbox.width, u.bbox.height);

    qt.clear();

    // force-clear the path cache to cause drawBars() to rebuild new quadtree
    u.series.forEach((s) => {
      // @ts-ignore
      s._paths = null;
    });
  };

  const setCursor = (u: uPlot) => {
    let cx = round(u.cursor!.left! * pxRatio);

    for (let i = 0; i < numSeries; i++) {
      let found: Rect | null = null;

      if (cx >= 0) {
        let cy = yMids[i];

        qt.get(cx, cy, 1, 1, (o) => {
          if (pointWithin(cx, cy, o.x, o.y, o.x + o.w, o.y + o.h)) {
            found = o;
          }
        });
      }

      let h = hoverMarks[i];

      if (found) {
        if (found !== hovered[i]) {
          hovered[i] = found;

          h.style.display = '';
          h.style.left = round(found!.x / pxRatio) + 'px';
          h.style.top = round(found!.y / pxRatio) + 'px';
          h.style.width = round(found!.w / pxRatio) + 'px';
          h.style.height = round(found!.h / pxRatio) + 'px';
        }
      } else if (hovered[i] != null) {
        h.style.display = 'none';
        hovered[i] = null;
      }
    }
  };

  // hide y crosshair & hover points
  const cursor: Partial<Cursor> = {
    y: false,
    points: { show: false },
  };

  const yMids: number[] = Array(numSeries).fill(0);
  const ySplits: number[] = Array(numSeries).fill(0);

  return {
    cursor,

    xSplits:
      mode === TimelineMode.Grid
        ? (u: uPlot, axisIdx: number, scaleMin: number, scaleMax: number, foundIncr: number, foundSpace: number) => {
            let splits = [];

            let dataIncr = u.data[0][1] - u.data[0][0];
            let skipFactor = ceil(foundIncr / dataIncr);

            for (let i = 0; i < u.data[0].length; i += skipFactor) {
              let v = u.data[0][i];

              if (v >= scaleMin && v <= scaleMax) {
                splits.push(v);
              }
            }

            return splits;
          }
        : null,

    xRange: (u: uPlot) => {
      const r = getTimeRange();

      let min = r.from.valueOf();
      let max = r.to.valueOf();

      if (mode === TimelineMode.Grid) {
        let colWid = u.data[0][1] - u.data[0][0];
        let scalePad = colWid / 2;

        if (min <= u.data[0][0]) {
          min = u.data[0][0] - scalePad;
        }

        let lastIdx = u.data[0].length - 1;

        if (max >= u.data[0][lastIdx]) {
          max = u.data[0][lastIdx] + scalePad;
        }
      }

      return [min, max] as uPlot.Range.MinMax;
    },

    ySplits: (u: uPlot) => {
      walk(rowHeight, null, numSeries, u.bbox.height, (iy, y0, hgt) => {
        // vertical midpoints of each series' timeline (stored relative to .u-over)
        yMids[iy] = round(y0 + hgt / 2);
        ySplits[iy] = u.posToVal(yMids[iy] / pxRatio, FIXED_UNIT);
      });

      return ySplits;
    },
    yValues: (u: uPlot, splits: number[]) => splits.map((v, i) => label(i + 1)),

    yRange: [0, 1] as uPlot.Range.MinMax,

    // pathbuilders
    drawPaths,
    drawPoints,

    // hooks
    init,
    drawClear,
    setCursor,
  };
}
