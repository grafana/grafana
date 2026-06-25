import type uPlot from 'uplot';

import { colorManipulator, type GrafanaTheme2 } from '@grafana/data';

import { type BoxRow } from './fields';

const { alpha, decomposeColor, recomposeColor } = colorManipulator;

export interface BoxplotDrawOpts {
  rows: BoxRow[];
  scaleKey: string;
  boxWidth: number;
  lineWidth: number;
  fillOpacity: number;
  outlierSize: number;
  theme: GrafanaTheme2;
}

/** Alpha-composite `fg` over `bg` to get the solid color the median line sits on. */
function effectiveBg(fg: string, bg: string, a: number): string {
  const f = decomposeColor(fg).values;
  const b = decomposeColor(bg).values;
  const mix = (i: number) => Math.round(f[i] * a + b[i] * (1 - a));
  return recomposeColor({ type: 'rgb', values: [mix(0), mix(1), mix(2)] });
}

/**
 * Builds the uPlot cursor + draw hook that render one box-and-whisker per row.
 * The boxes are drawn directly on the canvas; the tooltip resolves the hovered
 * box from the cursor's x position (each box owns its full-height category slot).
 */
export function getBoxplotDrawConfig(opts: BoxplotDrawOpts) {
  const { rows, scaleKey, boxWidth, lineWidth, fillOpacity, outlierSize, theme } = opts;

  // Median color is chosen to contrast the effective background under it (fill over
  // panel background), so it stays readable at any fill opacity in either theme.
  const fillA = Math.max(0, Math.min(1, fillOpacity / 100));
  const panelBg = theme.colors.background.primary;
  const medianColors = rows.map((r) => theme.colors.getContrastText(effectiveBg(r.color, panelBg, fillA)));
  // precomputed once (avoids re-parsing the color on every box, every frame)
  const fillColors = fillA > 0 ? rows.map((r) => alpha(r.color, fillA)) : null;

  // index of the box under the cursor, or null
  let hovered: number | null = null;

  const draw = (u: uPlot) => {
    const ctx = u.ctx;
    const lw = Math.max(1, lineWidth);
    const outlierR = Math.max(1, outlierSize);

    const xOf = (i: number) => Math.round(u.valToPos(i, 'x', true));
    const yOf = (v: number) => Math.round(u.valToPos(v, scaleKey, true));

    const slotPx = rows.length > 1 ? Math.abs(xOf(1) - xOf(0)) : u.bbox.width;
    const boxW = Math.max(2, Math.round(boxWidth * slotPx));
    const halfBox = Math.floor(boxW / 2);
    const halfCap = Math.floor(boxW * 0.3);

    ctx.save();
    ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
    ctx.clip();
    ctx.lineWidth = lw;

    rows.forEach((row, i) => {
      const cx = xOf(i);
      const q1Px = yOf(row.q1);
      const q3Px = yOf(row.q3);
      const medianPx = yOf(row.median);
      const whiskerHiPx = yOf(row.whiskerHi);
      const whiskerLoPx = yOf(row.whiskerLo);

      const boxTop = Math.min(q1Px, q3Px);
      const boxBtm = Math.max(q1Px, q3Px);
      const boxH = Math.max(1, boxBtm - boxTop);
      const left = cx - halfBox;

      ctx.strokeStyle = row.color;

      // box
      if (fillColors) {
        ctx.fillStyle = fillColors[i];
        ctx.fillRect(left, boxTop, boxW, boxH);
      }
      ctx.strokeRect(left, boxTop, boxW, boxH);

      // whiskers (stems + caps)
      ctx.beginPath();
      ctx.moveTo(cx, boxTop);
      ctx.lineTo(cx, whiskerHiPx);
      ctx.moveTo(cx, boxBtm);
      ctx.lineTo(cx, whiskerLoPx);
      ctx.moveTo(cx - halfCap, whiskerHiPx);
      ctx.lineTo(cx + halfCap, whiskerHiPx);
      ctx.moveTo(cx - halfCap, whiskerLoPx);
      ctx.lineTo(cx + halfCap, whiskerLoPx);
      ctx.stroke();

      // median line — contrasts the effective background so it stays readable at any fill opacity
      ctx.strokeStyle = medianColors[i];
      ctx.beginPath();
      ctx.moveTo(left, medianPx);
      ctx.lineTo(left + boxW, medianPx);
      ctx.stroke();
      ctx.strokeStyle = row.color;

      // outliers
      if (row.outlierHi != null) {
        ctx.beginPath();
        ctx.arc(cx, yOf(row.outlierHi), outlierR, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (row.outlierLo != null) {
        ctx.beginPath();
        ctx.arc(cx, yOf(row.outlierLo), outlierR, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    ctx.restore();
  };

  // series index whose cursor point carries the hover dot (an anchor series)
  const HOVER_SIDX = 1;
  const OFFSCREEN = { left: -10, top: -10, width: 0, height: 0 };

  const cursor: uPlot.Cursor = {
    // vertical crosshair line; no horizontal line
    x: true,
    y: false,
    drag: { x: false, y: false },
    dataIdx: (u, seriesIdx) => {
      if (seriesIdx === 0) {
        hovered = null;
        const left = u.cursor.left;
        if (left != null && left >= 0) {
          // each category owns the slot [i - 0.5, i + 0.5] on the x scale
          const i = Math.round(u.posToVal(left, 'x'));
          if (i >= 0 && i < rows.length) {
            hovered = i;
          }
        }
      }
      return seriesIdx === HOVER_SIDX ? hovered : null;
    },
    // force the anchor series to be "focused" whenever a box is hovered, so the
    // tooltip triggers across the whole column instead of only near the data point
    focus: {
      prox: 1e3,
      dist: (u, seriesIdx) => (hovered != null && seriesIdx === HOVER_SIDX ? 0 : Infinity),
    },
    points: {
      // small dot on the hovered box's median, colored to match the box
      stroke: () => (hovered != null ? rows[hovered].color : 'transparent'),
      fill: () => (hovered != null ? rows[hovered].color : 'transparent'),
      bbox: (u, seriesIdx) => {
        if (hovered == null || seriesIdx !== HOVER_SIDX) {
          return OFFSCREEN;
        }
        const r = 3;
        return {
          left: u.valToPos(hovered, 'x') - r,
          top: u.valToPos(rows[hovered].median, scaleKey) - r,
          width: r * 2,
          height: r * 2,
        };
      },
    },
  };

  return { cursor, draw };
}
