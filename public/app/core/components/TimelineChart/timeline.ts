import uPlot, { Series } from 'uplot';

import { GrafanaTheme2, TimeRange, colorManipulator } from '@grafana/data';
import { TimelineValueAlignment, VisibilityMode } from '@grafana/schema';
import { FIXED_UNIT } from '@grafana/ui';
import { distribute, SPACE_BETWEEN } from 'app/plugins/panel/barchart/distribute';
import { Quadtree, Rect } from 'app/plugins/panel/barchart/quadtree';
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
  hasMappedNaN: (seriesIdx: number) => boolean;
  getValueColor: (seriesIdx: number, value: unknown) => string;
  label: (seriesIdx: number) => string;
  getTimeRange: () => TimeRange;
  formatValue?: (seriesIdx: number, value: unknown) => string;
  getFieldConfig: (seriesIdx: number) => StateTimeLineFieldConfig | StatusHistoryFieldConfig;
  hoverMulti: boolean;
}

/**
 * @internal
 */
export function shouldDrawYValue(yValue: unknown, mappedNull?: boolean, mappedNaN?: boolean): boolean {
  if (typeof yValue === 'boolean') {
    return true;
  }
  if (typeof yValue === 'string') {
    return true;
  }
  if (typeof yValue === 'number' && !Number.isNaN(yValue)) {
    return true;
  }
  if (yValue === null && mappedNull) {
    return true;
  }
  if (Number.isNaN(yValue) && mappedNaN) {
    return true;
  }
  return !!yValue;
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
    hasMappedNaN,
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
    hoverMulti,
  } = opts;

  let qt: Quadtree;

  // Needed for to calculate text positions
  let boxRectsBySeries: TimelineBoxRect[][];

  const resetBoxRectsBySeries = (count: number) => {
    boxRectsBySeries = Array(numSeries)
      .fill(null)
      .map((v) => Array(count).fill(null));
  };

  const font = `500 ${Math.round(12 * devicePixelRatio)}px ${theme.typography.fontFamily}`;
  const hovered: Array<Rect | null> = Array(numSeries).fill(null);
  let hoveredAtCursor: Rect | null = null;

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
    // clamp width to allow small boxes to be rendered
    boxWidth = Math.max(1, boxWidth);

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
        const discrete = isDiscrete(sidx);
        const mappedNull = discrete && hasMappedNull(sidx);
        const mappedNaN = discrete && hasMappedNaN(sidx);

        u.ctx.save();
        rect(u.ctx, u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
        u.ctx.clip();

        walk(rowHeight, sidx - 1, numSeries, yDim, (iy, y0, height) => {
          if (mode === TimelineMode.Changes) {
            for (let ix = 0; ix < dataY.length; ix++) {
              let yVal = dataY[ix];
              const shouldDrawY = shouldDrawYValue(yVal, mappedNull, mappedNaN);

              if (shouldDrawY) {
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
              const shouldDrawY = shouldDrawYValue(yVal, mappedNull, mappedNaN);

              if (shouldDrawY) {
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
              let y = round(valToPosY(ySplits[sidx - 1], scaleY, yDim, yOff));

              const discrete = isDiscrete(sidx);
              const mappedNull = discrete && hasMappedNull(sidx);
              const mappedNaN = discrete && hasMappedNaN(sidx);

              for (let ix = 0; ix < dataY.length; ix++) {
                const yVal = dataY[ix];
                const shouldDrawY = shouldDrawYValue(yVal, mappedNull, mappedNaN);

                if (shouldDrawY) {
                  const boxRect = boxRectsBySeries[sidx - 1][ix];

                  if (!boxRect || boxRect.x >= xDim) {
                    continue;
                  }

                  // if x placement is negative, rect is left truncated, remove it from width for calculating how many chars will display
                  // right truncation happens automatically
                  const displayedBoxWidth = boxRect.x < 0 ? boxRect?.w + boxRect.x : boxRect?.w;

                  let maxChars = Math.floor(displayedBoxWidth / pxPerChar);

                  if (showValue === VisibilityMode.Auto && maxChars < 2) {
                    continue;
                  }

                  let txt = formatValue(sidx, dataY[ix]);

                  // center-aligned
                  let x = round(boxRect.x + xOff + boxRect.w / 2);
                  if (mode === TimelineMode.Changes) {
                    if (alignValue === 'left') {
                      x = round(Math.max(boxRect.x, 0) + xOff + strokeWidth + textPadding);
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
    let chars = '';
    for (let i = 32; i <= 126; i++) {
      chars += String.fromCharCode(i);
    }
    pxPerChar = Math.ceil((u.ctx.measureText(chars).width / chars.length) * uPlot.pxRatio);

    // be a bit more conservtive to prevent overlap
    pxPerChar += 2.5;

    u.root.querySelectorAll<HTMLDivElement>('.u-cursor-pt').forEach((el) => {
      el.style.borderRadius = '0';
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

  function setHovered(cx: number, cy: number, viaSync = false) {
    hovered.fill(null);
    hoveredAtCursor = null;

    if (cx < 0) {
      return;
    }

    // first gets all items in all quads intersected by a 1px wide by 10k high rect at the x cursor position and 0 y position.
    // (we use 10k instead of plot area height for simplicity and not having to pass around the uPlot instance)
    qt.get(cx, 0, uPlot.pxRatio, 1e4, (o) => {
      // filter only rects that intersect along x dir
      if (cx >= o.x && cx <= o.x + o.w) {
        // if also intersect along y dir, set both "direct hovered" and "one-of hovered"
        if (cy >= o.y && cy <= o.y + o.h) {
          hovered[o.sidx] = hoveredAtCursor = o;
        }
        // else only set "one-of hovered" (no "direct hovered") in multi mode or when synced
        else if (hoverMulti || viaSync) {
          hovered[o.sidx] = o;
        }
      }
    });
  }

  const cursor: uPlot.Cursor = {
    x: mode === TimelineMode.Changes,
    y: false,
    dataIdx: (u, seriesIdx) => {
      if (seriesIdx === 1) {
        // if quadtree is empty, fill it
        if (qt.o.length === 0 && qt.q == null) {
          for (const seriesRects of boxRectsBySeries) {
            for (const rect of seriesRects) {
              rect && qt.add(rect);
            }
          }
        }

        let cx = u.cursor.left! * uPlot.pxRatio;
        let cy = u.cursor.top! * uPlot.pxRatio;

        setHovered(cx, cy, u.cursor.event == null);
      }

      return hovered[seriesIdx]?.didx;
    },
    focus: {
      prox: 1e3,
      dist: (u, seriesIdx) => (hoveredAtCursor?.sidx === seriesIdx ? 0 : Infinity),
    },
    points: {
      fill: 'rgba(255,255,255,0.2)',
      bbox: (u, seriesIdx) => {
        let hRect = hovered[seriesIdx];
        let isHovered = hRect != null;

        return {
          left: isHovered ? hRect!.x / uPlot.pxRatio : -10,
          top: isHovered ? hRect!.y / uPlot.pxRatio : -10,
          width: isHovered ? hRect!.w / uPlot.pxRatio : 0,
          height: isHovered ? hRect!.h / uPlot.pxRatio : 0,
        };
      },
    },
  };

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
        let yMid = round(y0 + hgt / 2);
        ySplits[iy] = u.posToVal(yMid / uPlot.pxRatio, FIXED_UNIT);
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
  };
}

function getFillColor(fieldConfig: { fillOpacity?: number; lineWidth?: number }, color: string) {
  // if #rgba with pre-existing alpha. ignore fieldConfig.fillOpacity
  // e.g. thresholds with opacity
  if (color[0] === '#' && color.length === 9) {
    return color;
  }

  const opacityPercent = (fieldConfig.fillOpacity ?? 100) / 100;
  return colorManipulator.alpha(color, opacityPercent);
}
