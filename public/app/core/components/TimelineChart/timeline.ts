import uPlot, { Cursor, Series } from 'uplot';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { alpha } from '@grafana/data/src/themes/colorManipulator';
import { VisibilityMode, TimelineValueAlignment } from '@grafana/schema';
import { FIXED_UNIT } from '@grafana/ui/src/components/GraphNG/GraphNG';
import { distribute, SPACE_BETWEEN } from 'app/plugins/panel/barchart/distribute';
import { pointWithin, Quadtree, Rect } from 'app/plugins/panel/barchart/quadtree';
import { FieldConfig as StateTimeLineFieldConfig } from 'app/plugins/panel/state-timeline/panelcfg.gen';
import { FieldConfig as StatusHistoryFieldConfig } from 'app/plugins/panel/status-history/panelcfg.gen';

import { TimelineMode } from './utils';

const { round, min, ceil } = Math;

const textPadding = 2;

let pxPerChar = 6;

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
  fillColor: string;
}

/**
 * @internal
 */
export interface TimelineCoreOptions {
  mode: TimelineMode;
  alignValue?: TimelineValueAlignment;
  numSeries: number;
  rowHeight?: number;
  colWidth?: number;
  theme: GrafanaTheme2;
  showValue: VisibilityMode;
  mergeValues?: boolean;
  isDiscrete: (seriesIdx: number) => boolean;
  hasMappedNull: (seriesIdx: number) => boolean;
  getValueColor: (seriesIdx: number, value: unknown) => string;
  label: (seriesIdx: number) => string;
  getTimeRange: () => TimeRange;
  formatValue?: (seriesIdx: number, value: unknown) => string;
  getFieldConfig: (seriesIdx: number) => StateTimeLineFieldConfig | StatusHistoryFieldConfig;
  onHover: (seriesIdx: number, valueIdx: number, rect: Rect) => void;
  onLeave: () => void;
}

/**
 * @internal
 */
export function getConfig(opts: TimelineCoreOptions) {
  const {
    mode,
    numSeries,
    isDiscrete,
    hasMappedNull,
    rowHeight = 0,
    colWidth = 0,
    showValue,
    mergeValues = false,
    theme,
    label,
    formatValue,
    alignValue = 'left',
    getTimeRange,
    getValueColor,
    getFieldConfig,
    onHover,
    onLeave,
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
  const maxWidth = (size[1] ?? Infinity) * uPlot.pxRatio;

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
    value: number | null,
    discrete: boolean
  ) {
    // do not render super small boxes
    if (boxWidth < 1) {
      return;
    }

    const valueColor = getValueColor(seriesIdx + 1, value);
    const fieldConfig = getFieldConfig(seriesIdx);
    const fillColor = getFillColor(fieldConfig, valueColor);

    boxRectsBySeries[seriesIdx][valueIdx] = {
      x: round(left - xOff),
      y: round(top - yOff),
      w: boxWidth,
      h: boxHeight,
      sidx: seriesIdx + 1,
      didx: valueIdx,
      // for computing label contrast
      fillColor,
    };

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
        let strokeWidth = round((series.width || 0) * uPlot.pxRatio);

        let discrete = isDiscrete(sidx);
        let mappedNull = discrete && hasMappedNull(sidx);

        u.ctx.save();
        rect(u.ctx, u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
        u.ctx.clip();

        walk(rowHeight, sidx - 1, numSeries, yDim, (iy, y0, height) => {
          if (mode === TimelineMode.Changes) {
            for (let ix = 0; ix < dataY.length; ix++) {
              let yVal = dataY[ix];

              if (yVal != null || mappedNull) {
                let left = Math.round(valToPosX(dataX[ix], scaleX, xDim, xOff));

                let nextIx = ix;
                while (
                  ++nextIx < dataY.length &&
                  (dataY[nextIx] === undefined || (mergeValues && dataY[nextIx] === yVal))
                ) {}

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
                  right - left,
                  round(height),
                  strokeWidth,
                  iy,
                  ix,
                  yVal,
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
              let yVal = dataY[ix];

              if (yVal != null || mappedNull) {
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
                  yVal,
                  discrete
                );
              }
            }
          }
        });

        if (discrete) {
          u.ctx.lineWidth = strokeWidth;
          drawBoxes(u.ctx);
        }

        u.ctx.restore();
      }
    );

    return null;
  };

  const drawPoints: Series.Points.Show =
    formatValue == null || showValue === VisibilityMode.Never
      ? false
      : (u, sidx, i0, i1) => {
          u.ctx.save();
          u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
          u.ctx.clip();

          u.ctx.font = font;
          u.ctx.textAlign = mode === TimelineMode.Changes ? alignValue : 'center';
          u.ctx.textBaseline = 'middle';

          uPlot.orient(
            u,
            sidx,
            (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
              let strokeWidth = round((series.width || 0) * uPlot.pxRatio);

              let discrete = isDiscrete(sidx);
              let mappedNull = discrete && hasMappedNull(sidx);

              let y = round(yOff + yMids[sidx - 1]);

              for (let ix = 0; ix < dataY.length; ix++) {
                if (dataY[ix] != null || mappedNull) {
                  const boxRect = boxRectsBySeries[sidx - 1][ix];

                  if (!boxRect || boxRect.x >= xDim) {
                    continue;
                  }

                  let maxChars = Math.floor(boxRect?.w / pxPerChar);

                  if (showValue === VisibilityMode.Auto && maxChars < 2) {
                    continue;
                  }

                  let txt = formatValue(sidx, dataY[ix]);

                  // center-aligned
                  let x = round(boxRect.x + xOff + boxRect.w / 2);
                  if (mode === TimelineMode.Changes) {
                    if (alignValue === 'left') {
                      x = round(boxRect.x + xOff + strokeWidth + textPadding);
                    } else if (alignValue === 'right') {
                      x = round(boxRect.x + xOff + boxRect.w - strokeWidth - textPadding);
                    }
                  }

                  // TODO: cache by fillColor to avoid setting ctx for label
                  u.ctx.fillStyle = theme.colors.getContrastText(boxRect.fillColor, 3);
                  u.ctx.fillText(txt.slice(0, maxChars), x, y);
                }
              }
            }
          );

          u.ctx.restore();

          return false;
        };

  const init = (u: uPlot) => {
    let over = u.over;
    let chars = '';
    for (let i = 32; i <= 126; i++) {
      chars += String.fromCharCode(i);
    }
    pxPerChar = Math.ceil((u.ctx.measureText(chars).width / chars.length) * uPlot.pxRatio);

    // be a bit more conservtive to prevent overlap
    pxPerChar += 2.5;

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

  function setHoverMark(i: number, o: Rect | null) {
    let h = hoverMarks[i];

    let pxRatio = uPlot.pxRatio;

    if (o) {
      h.style.display = '';
      h.style.left = round(o.x / pxRatio) + 'px';
      h.style.top = round(o.y / pxRatio) + 'px';
      h.style.width = round(o.w / pxRatio) + 'px';
      h.style.height = round(o.h / pxRatio) + 'px';
    } else {
      h.style.display = 'none';
    }

    hovered[i] = o;
  }

  let hoveredAtCursor: Rect | undefined;

  function hoverMulti(cx: number, cy: number) {
    let foundAtCursor: Rect | undefined;

    for (let i = 0; i < numSeries; i++) {
      let found: Rect | undefined;

      if (cx >= 0) {
        let cy2 = yMids[i];

        qt.get(cx, cy2, 1, 1, (o) => {
          if (pointWithin(cx, cy2, o.x, o.y, o.x + o.w, o.y + o.h)) {
            found = o;

            if (Math.abs(cy - cy2) <= o.h / 2) {
              foundAtCursor = o;
            }
          }
        });
      }

      if (found) {
        if (found !== hovered[i]) {
          setHoverMark(i, found);
        }
      } else if (hovered[i] != null) {
        setHoverMark(i, null);
      }
    }

    if (foundAtCursor) {
      if (foundAtCursor !== hoveredAtCursor) {
        hoveredAtCursor = foundAtCursor;
        onHover(foundAtCursor.sidx, foundAtCursor.didx, foundAtCursor);
      }
    } else if (hoveredAtCursor) {
      hoveredAtCursor = undefined;
      onLeave();
    }
  }

  function hoverOne(cx: number, cy: number) {
    let foundAtCursor: Rect | undefined;

    qt.get(cx, cy, 1, 1, (o) => {
      if (pointWithin(cx, cy, o.x, o.y, o.x + o.w, o.y + o.h)) {
        foundAtCursor = o;
      }
    });

    if (foundAtCursor) {
      setHoverMark(0, foundAtCursor);

      if (foundAtCursor !== hoveredAtCursor) {
        hoveredAtCursor = foundAtCursor;
        onHover(foundAtCursor.sidx, foundAtCursor.didx, foundAtCursor);
      }
    } else if (hoveredAtCursor) {
      setHoverMark(0, null);
      hoveredAtCursor = undefined;
      onLeave();
    }
  }

  const doHover = mode === TimelineMode.Changes ? hoverMulti : hoverOne;

  const setCursor = (u: uPlot) => {
    let cx = round(u.cursor.left! * uPlot.pxRatio);
    let cy = round(u.cursor.top! * uPlot.pxRatio);

    // if quadtree is empty, fill it
    if (!qt.o.length && qt.q == null) {
      for (const seriesRects of boxRectsBySeries) {
        for (const rect of seriesRects) {
          rect && qt.add(rect);
        }
      }
    }

    doHover(cx, cy);
  };

  // hide y crosshair & hover points
  const cursor: Partial<Cursor> = {
    y: false,
    x: mode === TimelineMode.Changes,
    points: { show: false },
  };

  const yMids: number[] = Array(numSeries).fill(0);
  const ySplits: number[] = Array(numSeries).fill(0);
  const yRange: uPlot.Range.MinMax = [0, 1];

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

      const result: uPlot.Range.MinMax = [min, max];
      return result;
    },

    ySplits: (u: uPlot) => {
      walk(rowHeight, null, numSeries, u.bbox.height, (iy, y0, hgt) => {
        // vertical midpoints of each series' timeline (stored relative to .u-over)
        yMids[iy] = round(y0 + hgt / 2);
        ySplits[iy] = u.posToVal(yMids[iy] / uPlot.pxRatio, FIXED_UNIT);
      });

      return ySplits;
    },

    yValues: (u: uPlot, splits: number[]) => splits.map((v, i) => label(i + 1)),
    yRange,

    // pathbuilders
    drawPaths,
    drawPoints,

    // hooks
    init,
    drawClear,
    setCursor,
  };
}

function getFillColor(fieldConfig: { fillOpacity?: number; lineWidth?: number }, color: string) {
  // if #rgba with pre-existing alpha. ignore fieldConfig.fillOpacity
  // e.g. thresholds with opacity
  if (color[0] === '#' && color.length === 9) {
    return color;
  }

  const opacityPercent = (fieldConfig.fillOpacity ?? 100) / 100;
  return alpha(color, opacityPercent);
}
