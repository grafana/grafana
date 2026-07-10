import { css } from '@emotion/css';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type default as uPlot } from 'uplot';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { type UPlotConfigBuilder } from '@grafana/ui/internal';

import { WHEEL_ZOOM_BASE, type TimeRangeMs } from './timeModel';
import { type TimebarActions, type TimebarState } from './timebarState';

/** Width of a selection resize handle, in px. */
const HANDLE_WIDTH = 6;
/** Minimum selection width while resizing, in px. */
const MIN_SELECTION_PX = 10;

interface OverlayGeom {
  left: number;
  right: number;
  top: number;
  height: number;
}

// Coordinate helpers — a single, uPlot-timing-independent convention. The x scale is linear in time, so we
// map value<->pixel directly from the context window and the plot area geometry rather than uPlot's
// valToPos/posToVal (which read the scale that `setScale` commits asynchronously on a microtask).
// "container px" = relative to the plot wrapper; "over px" = relative to the plotting area's left edge.
const valToContainerPx = (over: HTMLElement, ms: number, ctx: TimeRangeMs): number =>
  over.offsetLeft + ((ms - ctx.from) / (ctx.to - ctx.from || 1)) * over.clientWidth;

const overPxToVal = (over: HTMLElement, overPx: number, ctx: TimeRangeMs): number =>
  ctx.from + (overPx / (over.clientWidth || 1)) * (ctx.to - ctx.from);

const containerPxToVal = (over: HTMLElement, containerPx: number, ctx: TimeRangeMs): number =>
  overPxToVal(over, containerPx - over.offsetLeft, ctx);

// Per-instance teardown for the imperative listeners attached in the uPlot `ready` hook.
const timebarCleanups = new WeakMap<uPlot, () => void>();

const getStyles = (theme: GrafanaTheme2) => ({
  selectionBox: css({
    position: 'absolute',
    background: theme.colors.primary.transparent,
    borderLeft: `1px solid ${theme.colors.primary.border}`,
    borderRight: `1px solid ${theme.colors.primary.border}`,
    cursor: 'grab',
    zIndex: 10,
  }),
  handle: css({
    position: 'absolute',
    width: HANDLE_WIDTH,
    background: theme.colors.primary.main,
    borderRadius: theme.shape.radius.default,
    cursor: 'ew-resize',
    zIndex: 11,
    '&:hover': {
      background: theme.colors.primary.shade,
    },
  }),
});

interface TimeNavigatorBrushPluginProps {
  config: UPlotConfigBuilder;
  /** The timebar model state (context window, selection, current interaction). */
  state: TimebarState;
  /** The timebar model actions (routes gestures through the reducer; only commits emit to the dashboard). */
  actions: TimebarActions;
  /** Plot width, used only to reposition the overlay on resize. */
  width: number;
  /** The plot-area container the overlay is portalled into (kept as a DOM sibling of the TimeSeries). */
  plotAreaRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * The timebar's self-contained brush: it registers all of the timebar's own interactions on the shared
 * TimeSeries uPlot config — drag-to-create selection (via `setSelect`), wheel-zoom of the context window,
 * and x-axis drag-pan of the context window — and renders the persistent selection overlay (box + resize
 * grips) with move/resize gestures.
 *
 * We deliberately do NOT mount TooltipPlugin2 / XAxisInteractionAreaPlugin from the panel — those would
 * re-enable drag-to-zoom of the dashboard; our brush owns the drag instead (`drag.setScale=false`) and
 * commits a *selection* rather than a scale change.
 *
 * All value<->pixel math uses the context window + plot-area geometry (see the helpers above) rather than
 * uPlot's val<->pos, so it is independent of `setScale`'s async commit timing. Gestures route through
 * `actions` (the reducer), so emit discipline stays centralized: only selection commits reach the dashboard.
 */
export const TimeNavigatorBrushPlugin = ({
  config,
  state,
  actions,
  width,
  plotAreaRef,
}: TimeNavigatorBrushPluginProps) => {
  const styles = useStyles2(getStyles);

  // Latest state/actions in refs so listeners attached once (in the uPlot `ready` hook) stay current.
  const uplotRef = useRef<uPlot | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const actionsRef = useRef<TimebarActions>(actions);
  actionsRef.current = actions;

  const [overlay, setOverlay] = useState<OverlayGeom | null>(null);
  // Removes any in-flight window drag/pan listeners (no commit) so a mid-gesture unmount can't leak them.
  const dragCleanup = useRef<(() => void) | null>(null);

  const updateOverlay = useCallback(() => {
    const u = uplotRef.current;
    if (!u) {
      return;
    }
    const over = u.over;
    const ctx = stateRef.current.contextWindow;
    const sel = stateRef.current.selection;
    // Clamp to the plot area so a selection outside the context window renders at the edge rather than
    // overflowing the container (which would grow the page / show scrollbars).
    const minPx = over.offsetLeft;
    const maxPx = over.offsetLeft + over.clientWidth;
    const clampPx = (px: number) => Math.max(minPx, Math.min(maxPx, px));
    setOverlay({
      left: clampPx(valToContainerPx(over, sel.from, ctx)),
      right: clampPx(valToContainerPx(over, sel.to, ctx)),
      top: over.offsetTop,
      height: over.clientHeight,
    });
  }, []);

  useLayoutEffect(() => {
    // A vertical cursor line but no y cursor; the brush drags on x only and never commits a scale change
    // (our brush reads the range and commits a selection instead). Disable cursor "points" — the dot that
    // snaps to each series at the mouse x — since this is a background ruler, not a data-inspection chart.
    config.setCursor({ x: true, y: false, points: { show: false }, drag: { x: true, y: false, setScale: false } });

    // uPlot native drag-select is used only to CREATE a new selection: read the range, commit it, then
    // clear uPlot's transient box (our overlay renders the persistent selection). We never call setSelect
    // programmatically, so this hook only ever fires from a genuine user brush.
    config.addHook('setSelect', (u: uPlot) => {
      if (stateRef.current.interaction !== 'idle') {
        return;
      }
      const { left, width: selWidth } = u.select;
      if (selWidth <= 0) {
        return;
      }
      const over = u.over;
      const ctx = stateRef.current.contextWindow;
      actionsRef.current.commitBrush({
        from: overPxToVal(over, left, ctx),
        to: overPxToVal(over, left + selWidth, ctx),
      });
      u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
    });

    config.addHook('ready', (u: uPlot) => {
      uplotRef.current = u;
      const ctx = stateRef.current.contextWindow;
      u.setScale('x', { min: ctx.from, max: ctx.to });

      // Wheel = zoom the context window around the selection (same as the zoom buttons), not the cursor.
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        actionsRef.current.zoom(e.deltaY < 0 ? WHEEL_ZOOM_BASE : 1 / WHEEL_ZOOM_BASE);
      };
      u.over.addEventListener('wheel', onWheel, { passive: false });

      // Drag on the x-axis = pan the context window (without changing the selection).
      const axis = u.root.querySelector<HTMLElement>('.u-axis');
      const onAxisPanStart = (e: MouseEvent) => {
        const startX = e.clientX;
        const start = stateRef.current.contextWindow;
        const msPerPx = (start.to - start.from) / (u.over.clientWidth || 1);
        actionsRef.current.beginGesture('panning');
        const onMove = (ev: MouseEvent) => {
          const deltaMs = -(ev.clientX - startX) * msPerPx;
          actionsRef.current.setContextWindow({ from: start.from + deltaMs, to: start.to + deltaMs });
        };
        let onUp: () => void;
        const removeListeners = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };
        onUp = () => {
          removeListeners();
          dragCleanup.current = null;
          actionsRef.current.endGesture();
        };
        dragCleanup.current = removeListeners;
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      };
      if (axis) {
        axis.style.cursor = 'grab';
        axis.addEventListener('mousedown', onAxisPanStart);
      }

      timebarCleanups.set(u, () => {
        u.over.removeEventListener('wheel', onWheel);
        axis?.removeEventListener('mousedown', onAxisPanStart);
      });

      requestAnimationFrame(updateOverlay);
    });

    config.addHook('destroy', (u: uPlot) => {
      timebarCleanups.get(u)?.();
      timebarCleanups.delete(u);
      if (uplotRef.current === u) {
        uplotRef.current = null;
      }
    });
  }, [config, updateOverlay]);

  // Push the context window to the x-scale (triggers a redraw) and reposition the overlay when either
  // range or the size changes. updateOverlay uses context math, so it's independent of setScale's timing.
  useEffect(() => {
    const u = uplotRef.current;
    if (!u) {
      return;
    }
    u.setScale('x', { min: state.contextWindow.from, max: state.contextWindow.to });
    updateOverlay();
  }, [
    state.contextWindow.from,
    state.contextWindow.to,
    state.selection.from,
    state.selection.to,
    width,
    updateOverlay,
  ]);

  // Remove any dangling window listeners if we unmount mid-drag (without committing).
  useEffect(() => () => dragCleanup.current?.(), []);

  const startSelectionDrag = useCallback((e: React.MouseEvent, kind: 'move' | 'left' | 'right') => {
    const u = uplotRef.current;
    if (!u) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const over = u.over;
    const ctx = stateRef.current.contextWindow;
    const interaction = kind === 'move' ? 'moving' : kind === 'left' ? 'resizingLeft' : 'resizingRight';
    actionsRef.current.beginGesture(interaction);

    const startX = e.clientX;
    const orig = stateRef.current.selection;
    const origFromPx = valToContainerPx(over, orig.from, ctx);
    const origToPx = valToContainerPx(over, orig.to, ctx);
    let latest = orig;
    let moved = false;

    // Keep the selection within the plot area (context window); dragging past an edge stops there.
    const minPx = over.offsetLeft;
    const maxPx = over.offsetLeft + over.clientWidth;
    const onMove = (ev: MouseEvent) => {
      const deltaPx = ev.clientX - startX;
      let fromPx = origFromPx;
      let toPx = origToPx;
      if (kind === 'move') {
        const w = origToPx - origFromPx;
        fromPx = Math.max(minPx, Math.min(maxPx - w, origFromPx + deltaPx));
        toPx = fromPx + w;
      } else if (kind === 'left') {
        fromPx = Math.max(minPx, Math.min(origFromPx + deltaPx, toPx - MIN_SELECTION_PX));
      } else {
        toPx = Math.min(maxPx, Math.max(origToPx + deltaPx, fromPx + MIN_SELECTION_PX));
      }
      latest = { from: containerPxToVal(over, fromPx, ctx), to: containerPxToVal(over, toPx, ctx) };
      moved = true;
      actionsRef.current.setSelection(latest); // update only — commit on mouseup
    };

    let onUp: () => void;
    const removeListeners = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    onUp = () => {
      removeListeners();
      dragCleanup.current = null;
      actionsRef.current.endGesture();
      if (moved) {
        actionsRef.current.setSelection(latest, true); // commit -> emit to dashboard
      }
    };

    dragCleanup.current = removeListeners;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const onOverlayWheel = useCallback((e: React.WheelEvent) => {
    actionsRef.current.zoom(e.deltaY < 0 ? WHEEL_ZOOM_BASE : 1 / WHEEL_ZOOM_BASE);
  }, []);

  const container = plotAreaRef.current;
  if (!overlay || !container) {
    return null;
  }

  const handleHeight = overlay.height * 0.6;
  const handleTop = overlay.top + (overlay.height - handleHeight) / 2;

  // Rendered as a DOM sibling of the TimeSeries inside the plot-area container (same position and container
  // px math as before the refactor), so pixel alignment is identical. Because the overlay is NOT a child of
  // uPlot's `over`, mousedown on empty plot area still reaches uPlot's own drag-to-create; the selection box
  // and grips sit above it (z-index) and stop propagation, so move/resize don't start a new brush.
  return createPortal(
    <>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- mouse-only supplementary control; the time picker is the accessible path */}
      <div
        className={styles.selectionBox}
        style={{
          left: overlay.left,
          top: overlay.top,
          width: overlay.right - overlay.left,
          height: overlay.height,
        }}
        onMouseDown={(e) => startSelectionDrag(e, 'move')}
        onWheel={onOverlayWheel}
      />
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- mouse-only resize handle */}
      <div
        className={styles.handle}
        style={{ left: overlay.left - HANDLE_WIDTH, top: handleTop, height: handleHeight }}
        onMouseDown={(e) => startSelectionDrag(e, 'left')}
      />
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- mouse-only resize handle */}
      <div
        className={styles.handle}
        style={{ left: overlay.right, top: handleTop, height: handleHeight }}
        onMouseDown={(e) => startSelectionDrag(e, 'right')}
      />
    </>,
    container
  );
};
