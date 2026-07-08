import { css } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type default as uPlot, type AlignedData } from 'uplot';

import { colorManipulator, type DataFrame, dateTimeFormat, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { GraphDrawStyle, ScaleDirection, ScaleOrientation, VisibilityMode } from '@grafana/schema';
import {
  AxisPlacement,
  DEFAULT_ANNOTATION_COLOR,
  IconButton,
  Popover,
  Tooltip,
  UPlotChart,
  UPlotConfigBuilder,
  useStyles2,
  useTheme2,
} from '@grafana/ui';

import { ContextWindowSelector } from './ContextWindowSelector';
import { WHEEL_ZOOM_BASE, type TimeRangeMs } from './timeModel';
import { type TimebarActions, useTimebar } from './timebarState';

/** Fixed height of the uPlot time ruler, in px. */
const CHART_HEIGHT = 50;
/** Width of a selection resize handle, in px. */
const HANDLE_WIDTH = 6;
/** Minimum selection width while resizing, in px. */
const MIN_SELECTION_PX = 10;

export interface TimeBarProps {
  /** The dashboard's current absolute time range (epoch ms). */
  value: TimeRangeMs;
  /** `Date.now()` — passed in so the model stays testable and renders stay pure. */
  now: number;
  width: number;
  height: number;
  /** Background sparkline(s): a shared time axis (epoch ms) plus one values array per series. */
  time: number[];
  values: number[][];
  /** Dashboard annotations to mark on the bar (frames tagged with the annotations data topic). */
  annotations?: DataFrame[];
  contextZoomFactor?: number;
  onChangeTimeRange: (range: TimeRangeMs) => void;
  /** Called when the zoomed-out context window changes, so a host can fetch background data for it. */
  onContextWindowChange?: (range: TimeRangeMs) => void;
  /** Extra controls rendered in the control row (e.g. a sparkline-source picker from the hosting surface). */
  extraControls?: React.ReactNode;
}

interface OverlayGeom {
  left: number;
  right: number;
  top: number;
  height: number;
  /** Plot area left offset + width, so annotation markers can be positioned with the same mapping. */
  overLeft: number;
  overWidth: number;
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

/** Read a named annotation-frame column, or undefined if the frame lacks it. */
const fieldValues = (frame: DataFrame, name: string): unknown[] | undefined =>
  frame.fields.find((f) => f.name === name)?.values;

// Per-instance teardown for the imperative listeners attached in the uPlot `ready` hook.
const timebarCleanups = new WeakMap<uPlot, () => void>();

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'relative',
  }),
  controlRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  }),
  popoverContent: css({
    backgroundColor: theme.colors.background.primary,
    padding: 8,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z2,
  }),
  plotArea: css({
    position: 'relative',
    overflow: 'hidden',
  }),
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
  // Small marker at the bottom (axis baseline) — the hover target. Sits below the selection box so
  // annotations under the selection are still hoverable, and it doesn't block dragging the selection body.
  annotationMarker: css({
    position: 'absolute',
    width: 12,
    height: 10,
    marginLeft: -6,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    cursor: 'pointer',
    zIndex: 12,
  }),
  // Upward-pointing triangle (colour set inline per annotation).
  annotationTriangle: css({
    width: 0,
    height: 0,
    borderLeft: '4px solid transparent',
    borderRight: '4px solid transparent',
    borderBottomWidth: 6,
    borderBottomStyle: 'solid',
  }),
  tooltipTime: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    marginBottom: theme.spacing(0.5),
  }),
  tooltipTags: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    marginTop: theme.spacing(0.5),
  }),
});

export const TimeBar: React.FC<TimeBarProps> = ({
  value,
  now,
  width,
  height,
  time,
  values,
  annotations,
  contextZoomFactor,
  onChangeTimeRange,
  onContextWindowChange,
  extraControls,
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const { state, actions } = useTimebar({ value, now, contextZoomFactor, onChangeTimeRange });

  // Latest state/actions in refs so listeners attached once (in the uPlot `ready` hook) stay current.
  const uplotRef = useRef<uPlot | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const actionsRef = useRef<TimebarActions>(actions);
  actionsRef.current = actions;
  // Annotation frames read live inside the uPlot `draw` hook (built once); ref keeps it current.
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const [overlay, setOverlay] = useState<OverlayGeom | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  // Removes any in-flight window drag/pan listeners (no commit) so a mid-gesture unmount can't leak them.
  const dragCleanup = useRef<(() => void) | null>(null);

  const chartWidth = Math.max(0, width);
  const seriesCount = values.length;

  // One aligned uPlot table: [time, ...series]. Stable identity so setData only fires on real data changes
  // (UPlotChart's check is by reference); combined with the pinned scale below this stops auto-ranging.
  const data = useMemo<AlignedData>(() => [time, ...values], [time, values]);

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
      overLeft: over.offsetLeft,
      overWidth: over.clientWidth,
    });
  }, []);

  // Build the uPlot config ONCE (keyed on theme). The x-scale is pinned to the context window via a range
  // function (so uPlot.setData can never auto-range over it) and pushed on change via setScale below.
  const builder = useMemo(() => {
    const b = new UPlotConfigBuilder();

    b.setCursor({ x: true, y: false, drag: { x: true, y: false, setScale: false } });
    b.addScale({
      scaleKey: 'x',
      isTime: true,
      orientation: ScaleOrientation.Horizontal,
      direction: ScaleDirection.Right,
      range: () => {
        const c = stateRef.current.contextWindow;
        return [c.from, c.to];
      },
    });
    b.addAxis({ placement: AxisPlacement.Bottom, scaleKey: 'x', isTime: true, theme });

    // Faint background sparkline(s) — one per referenced series, drawn behind the axis + overlay.
    b.addScale({ scaleKey: 'spark-y', orientation: ScaleOrientation.Vertical, direction: ScaleDirection.Up });
    b.addAxis({ scaleKey: 'spark-y', theme, placement: AxisPlacement.Hidden, show: false });
    for (let i = 0; i < seriesCount; i++) {
      b.addSeries({
        scaleKey: 'spark-y',
        theme,
        pxAlign: false,
        drawStyle: GraphDrawStyle.Line,
        lineColor: theme.colors.text.secondary,
        lineWidth: 1,
        showPoints: VisibilityMode.Never,
        pointSize: 0,
        spanNulls: true,
      });
    }

    // Annotation markers, drawn on top of the sparklines: a vertical line per event, plus a faint filled
    // rectangle for regions (timeEnd present). Frames are read live via a ref; a redraw is forced on change.
    const resolveColor = (name?: string) => {
      try {
        return theme.visualization.getColorByName(name ?? DEFAULT_ANNOTATION_COLOR);
      } catch {
        return theme.visualization.getColorByName(DEFAULT_ANNOTATION_COLOR);
      }
    };
    b.addHook('draw', (u: uPlot) => {
      const frames = annotationsRef.current;
      if (!frames?.length) {
        return;
      }
      const ctx = u.ctx;
      const top = u.bbox.top;
      const h = u.bbox.height;
      ctx.save();
      ctx.beginPath();
      ctx.rect(u.bbox.left, top, u.bbox.width, h);
      ctx.clip();
      ctx.lineWidth = window.devicePixelRatio || 1;
      for (const frame of frames) {
        const times = fieldValues(frame, 'time');
        if (!times) {
          continue;
        }
        const ends = fieldValues(frame, 'timeEnd');
        const colors = fieldValues(frame, 'color');
        const regions = fieldValues(frame, 'isRegion');
        for (let i = 0; i < times.length; i++) {
          const at = times[i];
          if (typeof at !== 'number') {
            continue;
          }
          const rawColor = colors?.[i];
          const color = resolveColor(typeof rawColor === 'string' ? rawColor : undefined);
          const x0 = Math.round(u.valToPos(at, 'x', true));
          const end = ends?.[i];
          if (regions?.[i] && typeof end === 'number') {
            const x1 = Math.round(u.valToPos(end, 'x', true));
            try {
              ctx.fillStyle = colorManipulator.alpha(color, 0.1);
            } catch {
              ctx.fillStyle = colorManipulator.alpha(DEFAULT_ANNOTATION_COLOR, 0.1);
            }
            ctx.fillRect(x0, top, x1 - x0, h);
          }
          ctx.strokeStyle = color;
          ctx.beginPath();
          ctx.moveTo(x0, top);
          ctx.lineTo(x0, top + h);
          ctx.stroke();
        }
      }
      ctx.restore();
    });

    // uPlot native drag-select is used only to CREATE a new selection: read the range, commit it, then
    // clear uPlot's transient box (our overlay renders the persistent selection). We never call setSelect
    // programmatically, so this hook only ever fires from a genuine user brush.
    b.addHook('setSelect', (u: uPlot) => {
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

    b.addHook('ready', (u: uPlot) => {
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

    b.addHook('destroy', (u: uPlot) => {
      timebarCleanups.get(u)?.();
      timebarCleanups.delete(u);
      if (uplotRef.current === u) {
        uplotRef.current = null;
      }
    });

    return b;
  }, [theme, updateOverlay, seriesCount]);

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
    chartWidth,
    updateOverlay,
  ]);

  // Remove any dangling window listeners if we unmount mid-drag (without committing).
  useEffect(() => () => dragCleanup.current?.(), []);

  // uPlot won't re-run its draw hooks just because the annotations ref changed — force a redraw.
  useEffect(() => {
    uplotRef.current?.redraw();
  }, [annotations]);

  // Report context-window changes so a host can fetch background data for the visible range.
  const onContextWindowChangeRef = useRef(onContextWindowChange);
  onContextWindowChangeRef.current = onContextWindowChange;
  useEffect(() => {
    onContextWindowChangeRef.current?.({ from: state.contextWindow.from, to: state.contextWindow.to });
  }, [state.contextWindow.from, state.contextWindow.to]);

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

  // Interactive hover targets for annotations: thin transparent strips over each canvas-drawn line, mapped
  // with the same context->pixel convention as the selection overlay (so they line up with the lines).
  const annotationMarkers = useMemo(() => {
    if (!overlay || !annotations?.length) {
      return [];
    }
    const ctx = state.contextWindow;
    const span = ctx.to - ctx.from || 1;
    const resolveColor = (name?: string) => {
      try {
        return theme.visualization.getColorByName(name ?? DEFAULT_ANNOTATION_COLOR);
      } catch {
        return theme.visualization.getColorByName(DEFAULT_ANNOTATION_COLOR);
      }
    };
    const markers: Array<{ x: number; when: string; text: string; tags: string[]; color: string }> = [];
    for (const frame of annotations) {
      const times = fieldValues(frame, 'time');
      if (!times) {
        continue;
      }
      const texts = fieldValues(frame, 'text');
      const tagsCol = fieldValues(frame, 'tags');
      const colors = fieldValues(frame, 'color');
      for (let i = 0; i < times.length; i++) {
        const at = times[i];
        if (typeof at !== 'number' || at < ctx.from || at > ctx.to) {
          continue;
        }
        const rawText = texts?.[i];
        const rawTags = tagsCol?.[i];
        const rawColor = colors?.[i];
        markers.push({
          x: overlay.overLeft + ((at - ctx.from) / span) * overlay.overWidth,
          when: dateTimeFormat(at),
          text: typeof rawText === 'string' ? rawText.replace(/<[^>]*>/g, '').trim() : '',
          tags: Array.isArray(rawTags) ? rawTags.filter((x): x is string => typeof x === 'string') : [],
          color: resolveColor(typeof rawColor === 'string' ? rawColor : undefined),
        });
      }
    }
    return markers;
  }, [annotations, overlay, state.contextWindow, theme]);

  const handleHeight = overlay ? overlay.height * 0.6 : 0;
  const handleTop = overlay ? overlay.top + (overlay.height - handleHeight) / 2 : 0;

  return (
    <div className={styles.wrapper} style={{ width, height }} data-testid="time-navigator">
      <div className={styles.controlRow}>
        <IconButton
          name="calendar-alt"
          tooltip={t('time-navigator.set-context-window', 'Set context window')}
          onClick={(e) => setAnchorEl(e.currentTarget)}
        />
        {anchorEl && (
          <Popover
            referenceElement={anchorEl}
            show={true}
            content={
              <div className={styles.popoverContent}>
                <ContextWindowSelector
                  contextWindow={state.contextWindow}
                  onApplyRelative={actions.applyRelativeContext}
                  onApplyAbsolute={actions.applyAbsoluteContext}
                  onClose={() => setAnchorEl(null)}
                />
              </div>
            }
          />
        )}
        <IconButton
          tooltip={t('time-navigator.pan-left', 'Pan left')}
          name="arrow-left"
          onClick={() => actions.pan('left')}
        />
        <IconButton
          tooltip={t('time-navigator.zoom-out', 'Zoom out context')}
          name="search-minus"
          onClick={() => actions.zoom(2)}
        />
        <IconButton
          tooltip={t('time-navigator.zoom-in', 'Zoom in context')}
          name="search-plus"
          onClick={() => actions.zoom(0.5)}
        />
        <IconButton
          tooltip={t('time-navigator.pan-right', 'Pan right')}
          name="arrow-right"
          onClick={() => actions.pan('right')}
        />
        <IconButton
          tooltip={t('time-navigator.reset', 'Reset context window')}
          name="crosshair"
          onClick={() => actions.reset()}
        />
        {extraControls}
      </div>

      <div className={styles.plotArea} style={{ width: chartWidth, height: CHART_HEIGHT }}>
        {chartWidth > 0 && <UPlotChart data={data} width={chartWidth} height={CHART_HEIGHT} config={builder} />}
        {overlay &&
          annotationMarkers.map((m, idx) => (
            <Tooltip
              key={idx}
              placement="top"
              content={
                <div>
                  {m.when && <div className={styles.tooltipTime}>{m.when}</div>}
                  {m.text && <div>{m.text}</div>}
                  {m.tags.length > 0 && <div className={styles.tooltipTags}>{m.tags.join(', ')}</div>}
                </div>
              }
            >
              <div className={styles.annotationMarker} style={{ left: m.x, top: overlay.top + overlay.height - 1 }}>
                <span className={styles.annotationTriangle} style={{ borderBottomColor: m.color }} />
              </div>
            </Tooltip>
          ))}
        {overlay && (
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
          </>
        )}
      </div>
    </div>
  );
};
