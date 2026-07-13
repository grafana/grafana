/**
 * The time navigator state machine: a `useReducer` with an explicit interaction state, replacing the seven
 * `useRef` flags the PoC used to coordinate context/selection/uPlot events. See ARCHITECTURE.md.
 *
 * Rules encoded here:
 *  - Only selection *commits* (brush end, move end, resize end) call `onChangeTimeRange`. Context changes
 *    (zoom/pan/wheel/popover) and dashboard-sync never emit — so no "suppress next update" flag is needed.
 *  - We never programmatically draw the selection via uPlot's `setSelect`, so its hook only fires on real
 *    user brushes — no "is programmatic select" flag is needed.
 *  - An incoming dashboard `value` that matches what we last emitted (or the current selection) is ignored
 *    as our own echo — one explicit comparison instead of scattered tolerances.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { durationToMs } from './duration';
import {
  CONTEXT_ZOOM_FACTOR,
  type TimeRangeMs,
  approxEqual,
  clampRange,
  computeContextWindow,
  extendedContext,
  midOf,
  panRange,
} from './timeModel';

// On external time changes the context window is treated as a stable "stage": we only reframe it when the
// selection runs off the stage or grows to crowd it, and then we make one generous move so the next is far
// off. These three knobs tune that (see syncFromDashboard).
/** Reframe once the selection occupies more than this fraction of the context width (crowding the stage). */
const REFRAME_FILL = 0.6;
/**
 * How far the selection may run past a context edge (as a fraction of the context span) before we reframe.
 * Non-zero so autorefresh's small forward drift doesn't reframe every tick.
 */
const REFRAME_EDGE_TOLERANCE = 0.05;
/**
 * When a reframe leaves the selection extending into the future, how much extra future room (as a fraction
 * of the reframed span) to leave beyond it, so subsequent zoom-outs are absorbed rather than re-reframing.
 * Set to 0 to show no empty future — at the cost of a reframe on every future-crossing zoom-out.
 */
const FUTURE_CUSHION = 0.25;

type Interaction = 'idle' | 'brushing' | 'moving' | 'resizingLeft' | 'resizingRight' | 'panning';

export interface TimeNavigatorState {
  interaction: Interaction;
  /** The zoomed-out view (uPlot x-scale range). */
  contextWindow: TimeRangeMs;
  /** The active dashboard time range, drawn as a brush inside the context window. */
  selection: TimeRangeMs;
  /** Set when the context is a relative "extend by <duration>" window, so it re-frames on autorefresh. */
  relativeDuration: string | null;
}

type Action =
  | { type: 'beginGesture'; interaction: Exclude<Interaction, 'idle'> }
  | { type: 'endGesture' }
  | { type: 'setSelection'; range: TimeRangeMs }
  | { type: 'setContextWindow'; range: TimeRangeMs; now: number }
  | { type: 'applyRelativeContext'; duration: string; now: number }
  | { type: 'syncFromDashboard'; range: TimeRangeMs; now: number; factor: number };

/**
 * Shift a proposed context window so it fully contains the selection — the selection (blue bar) must stay
 * within the visible view. Panning/zooming therefore stops when the selection reaches an edge, rather than
 * letting the selection drift off-screen (where the overlay would misleadingly pin to the edge). If the
 * context is narrower than the selection, centre it on the selection instead.
 */
function containSelection(context: TimeRangeMs, selection: TimeRangeMs): TimeRangeMs {
  const span = context.to - context.from;
  const selSpan = selection.to - selection.from;
  if (span <= selSpan) {
    const mid = midOf(selection);
    return { from: mid - span / 2, to: mid + span / 2 };
  }
  let { from, to } = context;
  if (selection.from < from) {
    from = selection.from;
    to = from + span;
  } else if (selection.to > to) {
    to = selection.to;
    from = to - span;
  }
  return { from, to };
}

function reducer(state: TimeNavigatorState, action: Action): TimeNavigatorState {
  switch (action.type) {
    case 'beginGesture':
      return { ...state, interaction: action.interaction };

    case 'endGesture':
      return { ...state, interaction: 'idle' };

    case 'setSelection':
      return { ...state, selection: clampRange(action.range) };

    case 'setContextWindow': {
      // Any manual context manipulation drops the relative framing, and must keep the selection in view.
      const contextWindow = containSelection(clampRange(action.range, { maxTo: action.now }), state.selection);
      return { ...state, contextWindow, relativeDuration: null };
    }

    case 'applyRelativeContext': {
      const ms = durationToMs(action.duration);
      if (ms == null) {
        return state; // invalid duration -> no-op, rather than freezing in a broken relative mode
      }
      // Cap at max(now, selection end) so a selection that reaches into the future isn't clipped out of
      // the context (extendedContext caps `to` at its 3rd arg, and clampRange's maxTo mirrors it).
      const cap = Math.max(action.now, state.selection.to);
      return {
        ...state,
        contextWindow: clampRange(extendedContext(state.selection, ms, cap), { maxTo: cap }),
        relativeDuration: action.duration,
      };
    }

    case 'syncFromDashboard': {
      const selection = clampRange(action.range);
      let contextWindow: TimeRangeMs;
      if (state.relativeDuration) {
        const ms = durationToMs(state.relativeDuration);
        // Cap at max(now, selection end) so a future-reaching selection isn't clipped out of the context.
        const cap = Math.max(action.now, selection.to);
        contextWindow =
          ms != null ? clampRange(extendedContext(selection, ms, cap), { maxTo: cap }) : state.contextWindow;
      } else {
        const selSpan = selection.to - selection.from;
        const ctxSpan = state.contextWindow.to - state.contextWindow.from;
        const { from: cFrom, to: cTo } = state.contextWindow;
        const mid = midOf(selection);

        // Treat the context window as a stable stage: leave it untouched while the selection is on it
        // (within a small edge tolerance that absorbs autorefresh drift) and isn't crowding it. Only when
        // the selection runs off an edge or grows to fill too much of the stage do we act — and then we
        // make ONE decisive, generous move so the next is far off (a stable stage the user can read and grab
        // beats frequent small nudges). Internal gestures never reach here: they clamp the selection to the
        // stage (move/resize) or drive the stage directly (pan/zoom).
        const edgeTol = ctxSpan * REFRAME_EDGE_TOLERANCE;
        const onStage = selection.from >= cFrom - edgeTol && selection.to <= cTo + edgeTol;
        const crowding = selSpan > ctxSpan * REFRAME_FILL;

        if (onStage && !crowding) {
          contextWindow = state.contextWindow;
        } else {
          // Reframe with a big runway (never smaller than the current stage, and >= selSpan * factor), so
          // the selection lands mid-stage with room to spare. The right edge is capped at `now` unless the
          // selection itself is in the future, where a small cushion beyond it (FUTURE_CUSHION) absorbs the
          // next few zoom-outs; the past side extends freely.
          const reSpan = Math.max(ctxSpan, selSpan * action.factor);
          const rightCap = selection.to > action.now ? selection.to + reSpan * FUTURE_CUSHION : action.now;
          const to = Math.min(mid + reSpan / 2, rightCap);
          contextWindow = { from: to - reSpan, to };
        }
      }
      return { ...state, selection, contextWindow };
    }

    default:
      return state;
  }
}

export interface UseTimeNavigatorArgs {
  /** The dashboard's current absolute time range. */
  value: TimeRangeMs;
  /** `Date.now()` at render, passed in so the model layer stays testable. */
  now: number;
  contextZoomFactor?: number;
  onChangeTimeRange: (range: TimeRangeMs) => void;
}

export interface TimeNavigatorActions {
  beginGesture: (interaction: Exclude<Interaction, 'idle'>) => void;
  endGesture: () => void;
  /** Update the selection during a drag; pass `commit` on the final update to push it to the dashboard. */
  setSelection: (range: TimeRangeMs, commit?: boolean) => void;
  /** Commit a freshly brushed selection (updates state and pushes to the dashboard). */
  commitBrush: (range: TimeRangeMs) => void;
  setContextWindow: (range: TimeRangeMs) => void;
  zoom: (factor: number) => void;
  pan: (direction: 'left' | 'right') => void;
  reset: () => void;
  applyRelativeContext: (duration: string) => void;
  applyAbsoluteContext: (range: TimeRangeMs) => void;
}

function initState(value: TimeRangeMs, now: number, factor: number): TimeNavigatorState {
  const selection = clampRange(value);
  return {
    interaction: 'idle',
    selection,
    contextWindow: computeContextWindow(selection, now, factor),
    relativeDuration: null,
  };
}

export function useTimeNavigator({
  value,
  now,
  contextZoomFactor = CONTEXT_ZOOM_FACTOR,
  onChangeTimeRange,
}: UseTimeNavigatorArgs): { state: TimeNavigatorState; actions: TimeNavigatorActions } {
  const [state, dispatch] = useReducer(reducer, undefined, () => initState(value, now, contextZoomFactor));

  // Latest-value refs so the sync effect and callbacks read current values without re-subscribing.
  const stateRef = useRef(state);
  stateRef.current = state;
  const nowRef = useRef(now);
  nowRef.current = now;
  const factorRef = useRef(contextZoomFactor);
  factorRef.current = contextZoomFactor;
  const onChangeRef = useRef(onChangeTimeRange);
  onChangeRef.current = onChangeTimeRange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const emit = useCallback((range: TimeRangeMs) => {
    onChangeRef.current(range);
  }, []);

  // Sync FROM the dashboard on genuine external changes only (time picker, autorefresh, other panels).
  // A commit sets selection === the emitted range, so the dashboard's echo is caught by the selection
  // comparison below — no separate "last emitted" flag is needed, and since syncFromDashboard never emits
  // there is no feedback loop.
  const { from: vFrom, to: vTo } = value;
  useEffect(() => {
    const s = stateRef.current;
    if (s.interaction !== 'idle') {
      return; // don't fight an in-progress gesture; re-checked on gesture end (see endGesture)
    }
    const incoming = { from: vFrom, to: vTo };
    if (approxEqual(incoming, s.selection)) {
      return; // already in sync (this also swallows our own echo)
    }
    dispatch({ type: 'syncFromDashboard', range: incoming, now: nowRef.current, factor: factorRef.current });
  }, [vFrom, vTo]);

  const setSelection = useCallback(
    (range: TimeRangeMs, commit = false) => {
      const clamped = clampRange(range);
      dispatch({ type: 'setSelection', range: clamped });
      if (commit) {
        emit(clamped);
      }
    },
    [emit]
  );

  const commitBrush = useCallback(
    (range: TimeRangeMs) => {
      const clamped = clampRange(range);
      dispatch({ type: 'setSelection', range: clamped });
      emit(clamped);
    },
    [emit]
  );

  const setContextWindow = useCallback((range: TimeRangeMs) => {
    dispatch({ type: 'setContextWindow', range, now: nowRef.current });
  }, []);

  const zoom = useCallback((factor: number) => {
    // Zoom the context window around the SELECTION (not the context midpoint) so the selection stays
    // framed and centered, and never shrink the context below the selection span (which would make the
    // selection overflow the view and appear clamped/smaller).
    const { contextWindow, selection } = stateRef.current;
    const newSpan = Math.max((contextWindow.to - contextWindow.from) * factor, selection.to - selection.from);
    const mid = midOf(selection);
    dispatch({
      type: 'setContextWindow',
      range: { from: mid - newSpan / 2, to: mid + newSpan / 2 },
      now: nowRef.current,
    });
  }, []);

  const pan = useCallback((direction: 'left' | 'right') => {
    dispatch({
      type: 'setContextWindow',
      range: panRange(stateRef.current.contextWindow, direction),
      now: nowRef.current,
    });
  }, []);

  const reset = useCallback(() => {
    dispatch({
      type: 'setContextWindow',
      range: computeContextWindow(stateRef.current.selection, nowRef.current, factorRef.current),
      now: nowRef.current,
    });
  }, []);

  const applyRelativeContext = useCallback((duration: string) => {
    dispatch({ type: 'applyRelativeContext', duration, now: nowRef.current });
  }, []);

  const applyAbsoluteContext = useCallback((range: TimeRangeMs) => {
    dispatch({ type: 'setContextWindow', range, now: nowRef.current });
  }, []);

  const beginGesture = useCallback((interaction: Exclude<Interaction, 'idle'>) => {
    dispatch({ type: 'beginGesture', interaction });
  }, []);

  const endGesture = useCallback(() => {
    // If an external dashboard change arrived while a *context* gesture (pan) was in progress, the sync
    // effect skipped it and won't re-run (its deps didn't change) — so re-apply it now. Selection
    // gestures commit their own value on release, so they don't need this.
    const wasContextGesture = stateRef.current.interaction === 'panning';
    dispatch({ type: 'endGesture' });
    if (wasContextGesture) {
      const v = valueRef.current;
      if (!approxEqual(v, stateRef.current.selection)) {
        dispatch({
          type: 'syncFromDashboard',
          range: { from: v.from, to: v.to },
          now: nowRef.current,
          factor: factorRef.current,
        });
      }
    }
  }, []);

  return {
    state,
    actions: {
      beginGesture,
      endGesture,
      setSelection,
      commitBrush,
      setContextWindow,
      zoom,
      pan,
      reset,
      applyRelativeContext,
      applyAbsoluteContext,
    },
  };
}
