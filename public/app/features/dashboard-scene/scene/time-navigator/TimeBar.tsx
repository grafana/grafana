import { css } from '@emotion/css';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type default as uPlot } from 'uplot';

import {
  colorManipulator,
  type DataFrame,
  dateTime,
  type Field,
  FeatureState,
  FieldColorModeId,
  FieldType,
  getDisplayProcessor,
  getTimeZone,
  type GrafanaTheme2,
  type TimeRange,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  AxisPlacement,
  GraphDrawStyle,
  type VizAnnotations,
  type VizLegendOptions,
  VisibilityMode,
} from '@grafana/schema';
import { FeatureBadge, IconButton, Popover, useStyles2, useTheme2 } from '@grafana/ui';
import { type UPlotConfigBuilder } from '@grafana/ui/internal';
import { TimeSeries } from 'app/core/components/TimeSeries/TimeSeries';
import { AnnotationsPlugin } from 'app/plugins/panel/timeseries/plugins/AnnotationsPlugin';

import { ContextWindowSelector } from './ContextWindowSelector';
import { WHEEL_ZOOM_BASE, type TimeRangeMs } from './timeModel';
import { type TimebarActions, type TimebarState, useTimebar } from './timebarState';

/** Fixed height of the time ruler, in px. */
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

// Per-instance teardown for the imperative listeners attached in the uPlot `ready` hook.
const timebarCleanups = new WeakMap<uPlot, () => void>();

// AnnotationsPlugin requires an interpolate function and a WIP-range setter; the timebar creates neither
// (it never edits annotations), so both are inert.
const noopInterpolate = (value: string) => value;
const noopSetNewRange = () => {};

// The timebar never shows a legend; a stable module-level object keeps TimeSeries from reconfiguring the
// plot every render (its `legend` prop is compared by reference).
const HIDDEN_LEGEND: VizLegendOptions = { showLegend: false, calcs: [], placement: 'bottom' };

// Thin, low-weight annotation lines (the plugin default width is 2) — this is a compact background ruler,
// so keep the markings light.
const ANNOTATION_OPTIONS: VizAnnotations = { lines: { width: 1 } };

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
});

interface InteractionPluginProps {
  config: UPlotConfigBuilder;
  uplotRef: React.MutableRefObject<uPlot | null>;
  stateRef: React.MutableRefObject<TimebarState>;
  actionsRef: React.MutableRefObject<TimebarActions>;
  dragCleanup: React.MutableRefObject<(() => void) | null>;
  updateOverlay: () => void;
}

/**
 * Registers the timebar's own interactions on the shared TimeSeries uPlot config: drag-to-create selection
 * (via `setSelect`), wheel-zoom of the context window, and x-axis drag-pan of the context window. It also
 * captures the uPlot instance in the `ready` hook so the persistent selection overlay (rendered in TimeBar)
 * can position itself with context math. We deliberately do NOT mount TooltipPlugin2 / XAxisInteractionArea
 * from the panel — those would re-enable drag-to-zoom of the dashboard; our brush owns the drag instead
 * (`drag.setScale=false`).
 */
const TimeBarInteraction = ({
  config,
  uplotRef,
  stateRef,
  actionsRef,
  dragCleanup,
  updateOverlay,
}: InteractionPluginProps) => {
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
  }, [config, uplotRef, stateRef, actionsRef, dragCleanup, updateOverlay]);

  return null;
};

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

  const [overlay, setOverlay] = useState<OverlayGeom | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  // Removes any in-flight window drag/pan listeners (no commit) so a mid-gesture unmount can't leak them.
  const dragCleanup = useRef<(() => void) | null>(null);

  const chartWidth = Math.max(0, width);
  const seriesCount = values.length;

  // Faint background sparkline(s) as a single DataFrame: one time field + one number field per series. Each
  // series is drawn faint (distinct theme-palette colors at half alpha) so overlapping series stay
  // distinguishable without competing with the selection overlay.
  const frame = useMemo<DataFrame>(() => {
    const palette = theme.visualization.palette;
    const seriesColor = (i: number) =>
      colorManipulator.alpha(theme.visualization.getColorByName(palette[i % palette.length]), 0.5);

    const timeField: Field = { name: 'time', type: FieldType.time, config: {}, values: time };
    const seriesFields: Field[] = values.map((vals, i) => {
      const field: Field = {
        // Unique name so tweakScale can give each series its own auto-ranging y-scale (see below).
        name: `series-${i}`,
        type: FieldType.number,
        values: vals,
        config: {
          color: { mode: FieldColorModeId.Fixed, fixedColor: seriesColor(i) },
          custom: {
            drawStyle: GraphDrawStyle.Line,
            lineWidth: 1,
            fillOpacity: 0,
            showPoints: VisibilityMode.Never,
            spanNulls: true,
            axisPlacement: AxisPlacement.Hidden,
            // A unique axis label per series makes buildScaleKey produce a distinct y-scale for each, so every
            // sparkline auto-ranges to its own min/max over the context window instead of sharing one scale.
            // The axis is Hidden, so the label text never renders.
            axisLabel: `series-${i}`,
          },
        },
      };
      field.display = getDisplayProcessor({ field, theme });
      return field;
    });

    return { name: 'timebar', fields: [timeField, ...seriesFields], length: time.length };
  }, [time, values, theme]);

  // Stable array identity so GraphNG doesn't re-align + re-setData on every render (it re-aligns whenever
  // the `frames` reference changes) — e.g. during a selection drag. Only changes when `frame` does.
  const frames = useMemo(() => [frame], [frame]);

  // Bump only when the frame structure (series count) changes, so TimeSeries re-inits the plot/config then
  // but NOT on every background-data update (which would reset the plot).
  const structureRevRef = useRef(0);
  const prevSeriesCount = useRef(seriesCount);
  if (prevSeriesCount.current !== seriesCount) {
    prevSeriesCount.current = seriesCount;
    structureRevRef.current += 1;
  }
  const structureRev = structureRevRef.current;

  // Drive the x-scale from the CONTEXT WINDOW (not the dashboard range). TimeSeries reads this via
  // getTimeRange for its x-scale range fn; we additionally push it imperatively (see effect below) because
  // TimeSeries only re-reads the range on data/size/config changes, and the context window can move alone.
  const contextTimeRange = useMemo<TimeRange>(() => {
    const from = dateTime(state.contextWindow.from);
    const to = dateTime(state.contextWindow.to);
    return { from, to, raw: { from, to } };
  }, [state.contextWindow.from, state.contextWindow.to]);

  const tz = getTimeZone();

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
        <FeatureBadge
          featureState={FeatureState.experimental}
          tooltip={t(
            'time-navigator.experimental-info',
            'Experimental. Sparkline and annotation selections are saved in your browser only (per dashboard), not in the dashboard.'
          )}
        />
      </div>

      <div className={styles.plotArea} style={{ width: chartWidth, height: CHART_HEIGHT }}>
        {chartWidth > 0 && (
          <TimeSeries
            frames={frames}
            timeRange={contextTimeRange}
            timeZone={tz}
            width={chartWidth}
            height={CHART_HEIGHT}
            legend={HIDDEN_LEGEND}
            structureRev={structureRev}
            replaceVariables={noopInterpolate}
          >
            {(config) => (
              <>
                <TimeBarInteraction
                  config={config}
                  uplotRef={uplotRef}
                  stateRef={stateRef}
                  actionsRef={actionsRef}
                  dragCleanup={dragCleanup}
                  updateOverlay={updateOverlay}
                />
                <AnnotationsPlugin
                  config={config}
                  annotations={annotations}
                  timeZone={tz}
                  newRange={null}
                  setNewRange={noopSetNewRange}
                  options={undefined}
                  replaceVariables={noopInterpolate}
                />
              </>
            )}
          </TimeSeries>
        )}
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
