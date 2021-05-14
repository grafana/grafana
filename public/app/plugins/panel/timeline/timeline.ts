import uPlot, { Series, Cursor } from 'uplot';
import { FIXED_UNIT } from '@grafana/ui/src/components/GraphNG/GraphNG';
import { Quadtree, Rect, pointWithin } from 'app/plugins/panel/barchart/quadtree';
import { distribute, SPACE_BETWEEN } from 'app/plugins/panel/barchart/distribute';
import { TimelineFieldConfig, TimelineMode, TimelineValueAlignment } from './types';
import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { BarValueVisibility } from '@grafana/ui';
import tinycolor from 'tinycolor2';

const { round, min, ceil } = Math;

const pxRatio = devicePixelRatio;

const laneDistr = SPACE_BETWEEN;

type WalkCb = (idx: number, offPx: number, dimPx: number) => void;

function walk(rowHeight: number, yIdx: number | null, count: number, dim: number, draw: WalkCb) {
  distribute(count, rowHeight, laneDistr, yIdx, (i, offPct, dimPct) => {
    let laneOffPx = dim * offPct;
    let laneWidPx = dim * dimPct;

    draw(i, laneOffPx, laneWidPx);
  });
}

interface TimelineBoxRect extends Rect {
  left: number;
  strokeWidth: number;
  fillColor: string;
}

/**
 * @internal
 */
export interface TimelineCoreOptions {
  mode: TimelineMode;
  numSeries: number;
  rowHeight: number;
  colWidth?: number;
  theme: GrafanaTheme2;
  showValue: BarValueVisibility;
  alignValue: TimelineValueAlignment;
  isDiscrete: (seriesIdx: number) => boolean;
  getValueColor: (seriesIdx: number, value: any) => string;
  label: (seriesIdx: number) => string;
  getTimeRange: () => TimeRange;
  formatValue?: (seriesIdx: number, value: any) => string;
  getFieldConfig: (seriesIdx: number) => TimelineFieldConfig;
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
    alignValue,
    theme,
    label,
    formatValue,
    getTimeRange,
    getValueColor,
    getFieldConfig,
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
      mark.style.background = 'rgba(255,255,255,0.2)';
      return mark;
    });

  // Needed for to calculate text positions
  let boxRectsBySeries: TimelineBoxRect[][];

  const resetBoxRectsBySeries = (count: number) => {
    boxRectsBySeries = Array(numSeries)
      .fill(null)
      .map((v) => Array(count).fill(null));
  };

  const font = `500 ${Math.round(12 * devicePixelRatio)}px ${theme.typography.fontFamily}`;
  const hovered: Array<Rect | null> = Array(numSeries).fill(null);

  const size = [colWidth, Infinity];
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
    left: number,
    top: number,
    boxWidth: number,
    boxHeight: number,
    strokeWidth: number,
    seriesIdx: number,
    valueIdx: number,
    value: any,
    discrete: boolean
  ) {
    // do not render super small boxes
    if (boxWidth < 1) {
      return;
    }

    const valueColor = getValueColor(seriesIdx + 1, value);
    const fieldConfig = getFieldConfig(seriesIdx);
    const fillColor = getFillColor(fieldConfig, valueColor);

    const boxRect = (boxRectsBySeries[seriesIdx][valueIdx] = {
      x: round(left - xOff),
      y: round(top - yOff),
      w: boxWidth,
      h: boxHeight,
      sidx: seriesIdx + 1,
      didx: valueIdx,
      // These two are needed for later text positioning
      left: left,
      strokeWidth,
      fillColor,
    });

    qt.add(boxRect);

    if (discrete) {
      let fillStyle = fillColor;
      let fillPath = fillPaths.get(fillStyle);

      if (fillPath == null) {
        fillPaths.set(fillStyle, (fillPath = new Path2D()));
      }

      rect(fillPath, left, top, boxWidth, boxHeight);

      if (strokeWidth) {
        let strokeStyle = valueColor;
        let strokePath = strokePaths.get(strokeStyle);

        if (strokePath == null) {
          strokePaths.set(strokeStyle, (strokePath = new Path2D()));
        }

        rect(
          strokePath,
          left + strokeWidth / 2,
          top + strokeWidth / 2,
          boxWidth - strokeWidth,
          boxHeight - strokeWidth
        );
      }
    } else {
      ctx.beginPath();
      rect(ctx, left, top, boxWidth, boxHeight);
      ctx.fillStyle = fillColor;
      ctx.fill();

      if (strokeWidth) {
        ctx.beginPath();
        rect(ctx, left + strokeWidth / 2, top + strokeWidth / 2, boxWidth - strokeWidth, boxHeight - strokeWidth);
        ctx.strokeStyle = valueColor;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
      }
    }
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

        walk(rowHeight, sidx - 1, numSeries, yDim, (iy, y0, height) => {
          if (mode === TimelineMode.Changes) {
            for (let ix = 0; ix < dataY.length; ix++) {
              if (dataY[ix] != null) {
                let left = Math.round(valToPosX(dataX[ix], scaleX, xDim, xOff));

                let nextIx = ix;
                while (dataY[++nextIx] === undefined && nextIx < dataY.length) {}

                // to now (not to end of chart)
                let right =
                  nextIx === dataY.length
                    ? xOff + xDim + strokeWidth
                    : Math.round(valToPosX(dataX[nextIx], scaleX, xDim, xOff));

                putBox(
                  u.ctx,
                  rect,
                  xOff,
                  yOff,
                  left,
                  round(yOff + y0),
                  right - left - 2,
                  round(height),
                  strokeWidth,
                  iy,
                  ix,
                  dataY[ix],
                  discrete
                );

                ix = nextIx - 1;
              }
            }
          } else if (mode === TimelineMode.Samples) {
            let colWid = valToPosX(dataX[1], scaleX, xDim, xOff) - valToPosX(dataX[0], scaleX, xDim, xOff);
            let gapWid = colWid * gapFactor;
            let barWid = round(min(maxWidth, colWid - gapWid) - strokeWidth);
            let xShift = barWid / 2;
            //let xShift = align === 1 ? 0 : align === -1 ? barWid : barWid / 2;

            for (let ix = idx0; ix <= idx1; ix++) {
              if (dataY[ix] != null) {
                // TODO: all xPos can be pre-computed once for all series in aligned set
                let left = valToPosX(dataX[ix], scaleX, xDim, xOff);

                putBox(
                  u.ctx,
                  rect,
                  xOff,
                  yOff,
                  round(left - xShift),
                  round(yOff + y0),
                  barWid,
                  round(height),
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
          u.ctx.textAlign = alignValue;
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
                  const boxRect = boxRectsBySeries[sidx - 1][ix];

                  // Todo refine this to better know when to not render text (when values do not fit)
                  if (!boxRect || boxRect.w < 20) {
                    continue;
                  }

                  const x = getTextPositionOffet(boxRect, alignValue);

                  u.ctx.fillStyle = theme.colors.getContrastText(boxRect.fillColor, 3);
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
    resetBoxRectsBySeries(u.data[0].length);

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
      mode === TimelineMode.Samples
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

      if (mode === TimelineMode.Samples) {
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

function getTextPositionOffet(rect: TimelineBoxRect, alignValue: TimelineValueAlignment) {
  // left or right aligned values shift 2 pixels inside edge
  const textPadding = alignValue === 'left' ? 2 : alignValue === 'right' ? -2 : 0;
  const { left, w, strokeWidth } = rect;

  return (
    left +
    strokeWidth / 2 +
    (alignValue === 'center' ? w / 2 - strokeWidth / 2 : alignValue === 'right' ? w - strokeWidth / 2 : 0) +
    textPadding
  );
}

function getFillColor(fieldConfig: TimelineFieldConfig, color: string) {
  const opacityPercent = (fieldConfig.fillOpacity ?? 100) / 100;
  return tinycolor(color).setAlpha(opacityPercent).toString();
}
