/**
 * Outcome of a tracked user journey.
 *
 * @public
 */
export type JourneyOutcome = 'success' | 'timeout' | 'abandoned' | 'error' | 'discarded' | 'canceled';

/**
 * Metadata describing a Critical User Journey type.
 * Stored in the registry - not per-instance data.
 *
 * @public
 */
export interface JourneyMeta {
  /** Unique identifier for this journey type. */
  type: string;
  /** Human-readable description of what this journey represents. */
  description: string;
  /** Team owning this journey (e.g. 'grafana-dashboards'). */
  owner: string;
  /** Maximum duration (ms) before the journey auto-ends with 'timeout'. */
  timeoutMs: number;
  /** If true (default), starting a journey of the same type cancels the previous instance. */
  cancelOnRestart?: boolean;
  /**
   * Other journey types that should be treated as parents. When any of these is
   * active at journey start, this journey's root span nests under it (same trace,
   * native Tempo waterfall) and `parent_journey.id` / `parent_journey.type`
   * attributes are recorded for queryability.
   *
   * Order matters: the first listed parent that is currently active wins. If
   * none are active, the journey starts a new trace as usual.
   */
  parents?: string[];
}

/**
 * Options when starting a new journey.
 *
 * @public
 */
export interface JourneyOptions {
  /** Arbitrary key-value metadata attached to the journey. */
  attributes?: Record<string, string>;
  /** Auto-end the journey with outcome 'timeout' after this many ms. Default 5 min. */
  timeoutMs?: number;
  /** @internal - set by registry, not by callers */
  cancelOnRestart?: boolean;
  /** @internal - set by registry from JourneyMeta.parents, not by callers */
  parents?: string[];
}

/**
 * Handle for a single step within a journey.
 *
 * @public
 */
export interface StepHandle {
  /** End this step. Calling after already ended is a safe no-op. */
  end(attributes?: Record<string, string>): void;
}

/**
 * Handle returned when starting a journey. Used to record steps and signal completion.
 *
 * @public
 */
export interface JourneyHandle {
  /**
   * Unique identifier for this journey instance. Stable across the lifetime of the journey.
   *
   * When OTel tracing is enabled this is the journey's root span ID, which is unique even
   * for journeys that nest under a parent (those share the parent's traceId, not the spanId).
   * When tracing is disabled this is a UUID generated at start time.
   */
  readonly journeyId: string;
  /**
   * OTel trace ID for the journey's root span, when tracing is enabled.
   * Empty string when tracing is disabled. Use this (not journeyId) to deep-link to a Tempo trace.
   * Nested journeys share their parent's traceId.
   */
  readonly traceId: string;
  /** The journey type name passed to startJourney. */
  readonly journeyType: string;
  /** False after end() has been called. */
  readonly isActive: boolean;
  /**
   * Record a pointwise event on the journey. Creates a zero-duration child span with the
   * given attributes - no handle returned, nothing to end. Safe no-op when the journey
   * has already ended.
   */
  recordEvent(name: string, attributes?: Record<string, string>): void;
  /**
   * Start a duration step on the journey. Returns a StepHandle - the caller MUST call
   * `step.end()` when the measured operation completes. Safe no-op when the journey
   * has already ended (returns a noop StepHandle).
   */
  startStep(name: string, attributes?: Record<string, string>): StepHandle;
  /** End the journey with a given outcome. Idempotent - second call is a no-op. */
  end(outcome: JourneyOutcome, attributes?: Record<string, string>): void;
  /** Merge additional attributes into the journey. */
  setAttributes(attributes: Record<string, string>): void;
  /** Register a callback that fires when this journey ends (any outcome). @internal */
  onEnd(callback: () => void): void;
}

/**
 * Service for tracking Critical User Journeys across the Grafana frontend.
 *
 * Obtain via {@link getJourneyTracker}. When the feature is disabled, all calls
 * hit a zero-overhead {@link NoopJourneyTracker}.
 *
 * @public
 */
export interface JourneyTracker {
  /** Start a new journey of the given type. */
  startJourney(journeyType: string, options?: JourneyOptions): JourneyHandle;
  /** Get the currently active journey of a type, or null. */
  getActiveJourney(journeyType: string): JourneyHandle | null;
  /** Cancel all active journeys. */
  cancelAll(): void;
}

// ---------------------------------------------------------------------------
// Noop implementations - truly zero overhead when feature is disabled
// ---------------------------------------------------------------------------

class NoopStepHandle implements StepHandle {
  end(): void {}
}

const NOOP_STEP = new NoopStepHandle();

class NoopJourneyHandle implements JourneyHandle {
  readonly journeyId = '';
  readonly traceId = '';
  readonly journeyType = '';
  readonly isActive = false;

  recordEvent(): void {}
  startStep(): StepHandle {
    return NOOP_STEP;
  }
  end(): void {}
  setAttributes(): void {}
  onEnd(): void {}
}

const NOOP_HANDLE = new NoopJourneyHandle();

class NoopJourneyTracker implements JourneyTracker {
  startJourney(_journeyType?: string, _options?: JourneyOptions): JourneyHandle {
    return NOOP_HANDLE;
  }
  getActiveJourney(_journeyType?: string): JourneyHandle | null {
    return null;
  }
  cancelAll(): void {}
}

// ---------------------------------------------------------------------------
// Singleton getter / setter (mirrors EchoSrv pattern)
// ---------------------------------------------------------------------------

let singletonInstance: JourneyTracker | undefined;

/**
 * Set the global JourneyTracker implementation. Called once during app bootstrap
 * when the feature toggle is enabled.
 *
 * @internal
 */
export function setJourneyTracker(instance: JourneyTracker): void {
  singletonInstance = instance;
}

/**
 * Retrieve the global {@link JourneyTracker}. Returns a zero-overhead
 * {@link NoopJourneyTracker} when the feature has not been initialised.
 *
 * @public
 */
export function getJourneyTracker(): JourneyTracker {
  if (!singletonInstance) {
    singletonInstance = new NoopJourneyTracker();
  }
  return singletonInstance;
}

// ---------------------------------------------------------------------------
// Split registration API (Proposal 3 - Hybrid)
// ---------------------------------------------------------------------------

/**
 * Callback for setting up journey triggers (start conditions).
 * Runs once at registration time. Sets up interaction subscriptions
 * and calls tracker.startJourney() inside them. Returns a cleanup function.
 *
 * @internal
 */
export type JourneyTriggersFn = (tracker: JourneyTracker) => () => void;

/**
 * Callback for setting up journey end conditions.
 * Called per journey instance - receives the handle for that specific instance.
 * Sets up interaction subscriptions that call handle.end(). Returns a cleanup function.
 *
 * @internal
 */
export type JourneyInstanceFn = (handle: JourneyHandle) => () => void;

/**
 * Interface for the journey registry that manages metadata and trigger registration.
 *
 * @internal
 */
export interface JourneyRegistry {
  /** Initialize the registry with journey metadata definitions. */
  init(metadata: JourneyMeta[]): void;
  /** Register triggers that start a journey. Runs triggersFn immediately. Called once at bootstrap. */
  registerTriggers(journeyType: string, triggersFn: JourneyTriggersFn): void;
  /** Called with each journey instance's handle when a journey of this type starts. Wire up end conditions here. */
  onInstance(journeyType: string, instanceFn: JourneyInstanceFn): void;
  /** Clean up all subscriptions. */
  destroy(): void;
}

let registryInstance: JourneyRegistry | undefined;

/**
 * Set the global JourneyRegistry implementation. Called once during app bootstrap.
 *
 * @internal
 */
export function setJourneyRegistry(instance: JourneyRegistry): void {
  registryInstance = instance;
}

/**
 * Register triggers that start a journey type. Called ONCE at bootstrap.
 *
 * The triggersFn runs immediately - set up interaction subscriptions inside it.
 * Call tracker.startJourney() inside those subscriptions when the start condition is met.
 *
 * @public
 */
export function registerJourneyTriggers(journeyType: string, triggersFn: JourneyTriggersFn): void {
  if (!registryInstance) {
    return; // Feature disabled - silent no-op
  }
  registryInstance.registerTriggers(journeyType, triggersFn);
}

/**
 * Called once per journey instance when startJourney fires. Use it to wire
 * up end conditions (onInteraction listeners that call handle.end()).
 * Can be registered at bootstrap (eager) or later from feature code (lazy).
 * Buffered instances are replayed if registered late.
 *
 * @public
 */
export function onJourneyInstance(journeyType: string, instanceFn: JourneyInstanceFn): void {
  if (!registryInstance) {
    return; // Feature disabled - silent no-op
  }
  registryInstance.onInstance(journeyType, instanceFn);
}
