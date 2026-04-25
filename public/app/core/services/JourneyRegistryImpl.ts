import {
  type JourneyHandle,
  type JourneyMeta,
  type JourneyRegistry,
  type JourneyTriggersFn,
  type JourneyInstanceFn,
  getJourneyTracker,
} from '@grafana/runtime';
import { createDebugLog } from 'app/core/utils/debugLog';

const debugLog = createDebugLog('journeyTracker', 'JourneyRegistry');

/**
 * Implementation of JourneyRegistry (hybrid: metadata registry + split triggers).
 *
 * - Stores journey metadata, trigger fns, end handler fns
 * - registerTriggers: validates type exists, calls triggersFn(tracker) immediately
 * - onInstance: stores instanceFn, replays buffered handles, hooks into future starts
 * - Handle buffering: when startJourney fires and no instanceFn is registered, buffer the handle.
 *   When onInstance arrives, replay buffered handles. Clean up on timeout.
 */
export class JourneyRegistryImpl implements JourneyRegistry {
  private metadata = new Map<string, JourneyMeta>();
  private registeredTriggers = new Set<string>();
  private triggerCleanups: Array<() => void> = [];
  private instanceFns = new Map<string, JourneyInstanceFn>();
  /** Per-handle end-trigger cleanups, keyed by journeyId. */
  private endCleanups = new Map<string, () => void>();

  /**
   * Buffered handles: when a journey starts but no instanceFn is registered yet,
   * we store the handle here. When onInstance arrives, we replay them.
   */
  private bufferedHandles = new Map<string, JourneyHandle[]>();
  private bufferTimers = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();

  init(metadataList: JourneyMeta[]): void {
    for (const meta of metadataList) {
      this.metadata.set(meta.type, meta);
    }
  }

  registerTriggers(journeyType: string, triggersFn: JourneyTriggersFn): void {
    const meta = this.metadata.get(journeyType);
    if (!meta) {
      throw new Error(
        `[JourneyRegistry] registerTriggers called for unknown journey type "${journeyType}". ` +
          `Register it in the JOURNEY_REGISTRY first.`
      );
    }

    this.registeredTriggers.add(journeyType);
    debugLog('registerTriggers', journeyType);

    const tracker = getJourneyTracker();

    // Wrap the tracker to intercept startJourney calls so we can
    // apply registry metadata and hook end handlers.
    const wrappedTracker = this.createWrappedTracker(tracker, meta);

    const cleanup = triggersFn(wrappedTracker);
    this.triggerCleanups.push(cleanup);
  }

  onInstance(journeyType: string, instanceFn: JourneyInstanceFn): void {
    const meta = this.metadata.get(journeyType);
    if (!meta) {
      throw new Error(
        `[JourneyRegistry] onInstance called for unknown journey type "${journeyType}". ` +
          `Register it in the JOURNEY_REGISTRY first.`
      );
    }

    if (this.instanceFns.has(journeyType)) {
      throw new Error(
        `[JourneyRegistry] onInstance called for journey type "${journeyType}" which already has an end handler registered. ` +
          `Each journey type can only have one end handler.`
      );
    }

    this.instanceFns.set(journeyType, instanceFn);
    debugLog('onInstance', journeyType);

    // Replay any buffered handles
    const buffered = this.bufferedHandles.get(journeyType);
    if (buffered) {
      for (const handle of buffered) {
        if (handle.isActive) {
          this.attachEndHandler(journeyType, handle, instanceFn);
        }
      }
      this.bufferedHandles.delete(journeyType);

      // Clear buffer timers
      const timers = this.bufferTimers.get(journeyType);
      if (timers) {
        for (const timer of timers.values()) {
          clearTimeout(timer);
        }
        this.bufferTimers.delete(journeyType);
      }
    }
  }

  destroy(): void {
    // Clean up trigger subscriptions
    for (const cleanup of this.triggerCleanups) {
      cleanup();
    }
    this.triggerCleanups = [];

    // Clean up end handler subscriptions
    for (const cleanup of this.endCleanups.values()) {
      cleanup();
    }
    this.endCleanups.clear();

    // Clear buffer timers
    for (const timers of this.bufferTimers.values()) {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    }
    this.bufferTimers.clear();
    this.bufferedHandles.clear();
    this.instanceFns.clear();
    this.metadata.clear();
    this.registeredTriggers.clear();
  }

  /**
   * Log a warning for each registry entry that has no triggers registered.
   * Call this at the end of bootstrap to surface misconfigured journeys.
   */
  warnUnregistered(): void {
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    for (const [type] of this.metadata) {
      if (!this.registeredTriggers.has(type)) {
        console.warn(
          `[JourneyRegistry] Registry entry "${type}" has no triggers registered. ` +
            `Did you forget to import its wiring module?`
        );
      }
    }
  }

  /**
   * Create a wrapped tracker that intercepts startJourney to apply registry
   * metadata (timeoutMs, cancelOnRestart) and automatically attach end handlers.
   */
  private createWrappedTracker(
    tracker: ReturnType<typeof getJourneyTracker>,
    meta: JourneyMeta
  ): ReturnType<typeof getJourneyTracker> {
    return {
      startJourney: (journeyType, options) => {
        // Merge registry metadata with caller options (caller wins on conflict).
        // Filter out explicit undefined values from options to prevent overriding registry defaults.
        const mergedOptions = {
          timeoutMs: meta.timeoutMs,
          cancelOnRestart: meta.cancelOnRestart ?? true,
          parents: meta.parents,
          ...Object.fromEntries(Object.entries(options ?? {}).filter(([, v]) => v !== undefined)),
        };

        const handle = tracker.startJourney(journeyType, mergedOptions);

        // Try to attach end handler
        const instanceFn = this.instanceFns.get(journeyType);
        if (instanceFn) {
          this.attachEndHandler(journeyType, handle, instanceFn);
        } else {
          // Buffer the handle for late registration. Use the effective timeout
          // (caller override or registry default) so we don't outlive the journey itself.
          this.bufferHandle(journeyType, handle, mergedOptions.timeoutMs);
        }

        return handle;
      },
      getActiveJourney: (type) => tracker.getActiveJourney(type),
      cancelAll: () => tracker.cancelAll(),
    };
  }

  private attachEndHandler(_journeyType: string, handle: JourneyHandle, instanceFn: JourneyInstanceFn): void {
    const cleanup = instanceFn(handle);
    const journeyId = handle.journeyId;

    this.endCleanups.set(journeyId, cleanup);

    handle.onEnd(() => {
      const fn = this.endCleanups.get(journeyId);
      if (fn) {
        fn();
        this.endCleanups.delete(journeyId);
      }
    });
  }

  private bufferHandle(journeyType: string, handle: JourneyHandle, timeoutMs: number): void {
    let handles = this.bufferedHandles.get(journeyType);
    if (!handles) {
      handles = [];
      this.bufferedHandles.set(journeyType, handles);
    }
    handles.push(handle);

    // Set a timer to remove the buffered handle after timeout
    let timers = this.bufferTimers.get(journeyType);
    if (!timers) {
      timers = new Map();
      this.bufferTimers.set(journeyType, timers);
    }

    const evict = () => this.evictBuffered(journeyType, handle);

    const timer = setTimeout(evict, timeoutMs);
    timers.set(handle.journeyId, timer);

    // If the handle ends on its own (naturally or via cancel) before the timer
    // fires, drop it from the buffer immediately. Without this, a short-lived
    // journey would squat a buffer slot and a pending timer for up to its
    // full timeoutMs (could be an hour for datasource_configure).
    handle.onEnd(evict);
  }

  /** Remove a single buffered handle and clear its timer. Safe to call multiple times. */
  private evictBuffered(journeyType: string, handle: JourneyHandle): void {
    const handles = this.bufferedHandles.get(journeyType);
    if (handles) {
      const idx = handles.indexOf(handle);
      if (idx !== -1) {
        handles.splice(idx, 1);
      }
      if (handles.length === 0) {
        this.bufferedHandles.delete(journeyType);
      }
    }
    const timers = this.bufferTimers.get(journeyType);
    if (timers) {
      const timer = timers.get(handle.journeyId);
      if (timer) {
        clearTimeout(timer);
        timers.delete(handle.journeyId);
      }
      if (timers.size === 0) {
        this.bufferTimers.delete(journeyType);
      }
    }
  }
}
