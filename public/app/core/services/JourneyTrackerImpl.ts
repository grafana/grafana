import { type Span, type Tracer, context, trace, SpanStatusCode, type Link } from '@opentelemetry/api';

import {
  type JourneyHandle,
  type JourneyOptions,
  type JourneyOutcome,
  type JourneyTracker,
  type StepHandle,
  config,
  logMeasurement,
} from '@grafana/runtime';
import { createDebugLog } from 'app/core/utils/debugLog';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const ABANDONED_TAB_HIDDEN_MS = 60 * 1000; // 60 seconds

const debugLog = createDebugLog('journeyTracker', 'JourneyTracker');

/**
 * RFC4122 v4 UUID. Prefers `crypto.randomUUID` and falls back to `getRandomValues` for
 * browsers / environments where randomUUID isn't exposed (HTTP contexts, older WebViews).
 * The framework runs in many environments and we'd rather degrade than throw.
 */
function uuidv4(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Real JourneyTracker implementation backed by OTel spans (when available)
 * and Faro measurements. Registered at bootstrap when the feature toggle is on.
 */
export class JourneyTrackerImpl implements JourneyTracker {
  private activeJourneys = new Map<string, JourneyHandleImpl>();
  private tracer: Tracer | null = null;
  private tracingEnabled: boolean;
  private tabHiddenAt: number | null = null;

  constructor() {
    this.tracingEnabled =
      config.grafanaJavascriptAgent.enabled && config.grafanaJavascriptAgent.tracingInstrumentalizationEnabled;

    if (this.tracingEnabled) {
      this.tracer = trace.getTracer('grafana-journey-tracker');
    }

    this.setupVisibilityTracking();
    this.setupBeforeUnload();
  }

  startJourney(journeyType: string, options?: JourneyOptions): JourneyHandle {
    const cancelOnRestart = options?.cancelOnRestart ?? true;

    // Cancel existing journey of the same type when cancelOnRestart is true
    if (cancelOnRestart) {
      const existingHandles = [...this.activeJourneys.values()];
      for (const existing of existingHandles) {
        if (existing.journeyType === journeyType) {
          existing.end('canceled');
        }
      }
    }

    // Resolve a parent journey, if the registry declared one. The first listed
    // parent that is currently active wins. The parent is excluded from concurrent
    // bookkeeping below — it's a structural relationship, not a coincidence.
    let parentHandle: JourneyHandleImpl | null = null;
    if (options?.parents?.length) {
      for (const parentType of options.parents) {
        const candidate = this.getActiveJourneyImpl(parentType);
        if (candidate) {
          parentHandle = candidate;
          break;
        }
      }
    }

    // Collect links to all other active journeys for concurrent context
    const MAX_CONCURRENT_LINKS = 5;
    const concurrentLinks: Link[] = [];
    const concurrentAttributes: Record<string, string> = {};
    let concurrentIdx = 0;
    let totalConcurrent = 0;

    for (const handle of this.activeJourneys.values()) {
      if (handle === parentHandle) {
        continue;
      }
      if (handle.journeyType !== journeyType || !cancelOnRestart) {
        if (concurrentIdx < MAX_CONCURRENT_LINKS) {
          concurrentAttributes[`concurrent_journey_${concurrentIdx}_type`] = handle.journeyType;
          concurrentAttributes[`concurrent_journey_${concurrentIdx}_id`] = handle.journeyId;
          if (handle.span) {
            concurrentLinks.push({ context: handle.span.spanContext() });
          }
          concurrentIdx++;
        }
        totalConcurrent++;
      }
    }
    if (totalConcurrent > 0) {
      concurrentAttributes['concurrent_journey_count'] = String(totalConcurrent);
    }

    const parentAttributes: Record<string, string> = parentHandle
      ? {
          'parent_journey.type': parentHandle.journeyType,
          'parent_journey.id': parentHandle.journeyId,
        }
      : {};

    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const mergedAttributes = { ...concurrentAttributes, ...parentAttributes, ...options?.attributes };

    const handle = new JourneyHandleImpl(
      journeyType,
      this.tracer,
      mergedAttributes,
      concurrentLinks,
      timeoutMs,
      () => this.activeJourneys.delete(handle.journeyId),
      parentHandle?.span ?? null
    );

    this.activeJourneys.set(handle.journeyId, handle);
    debugLog('startJourney', journeyType, {
      journeyId: handle.journeyId,
      timeoutMs,
      cancelOnRestart,
      attributes: mergedAttributes,
      concurrentJourneys: concurrentIdx,
    });
    return handle;
  }

  getActiveJourney(journeyType: string): JourneyHandle | null {
    return this.getActiveJourneyImpl(journeyType);
  }

  /** Internal variant returning the concrete handle (with `span` access). */
  private getActiveJourneyImpl(journeyType: string): JourneyHandleImpl | null {
    let latest: JourneyHandleImpl | null = null;
    for (const handle of this.activeJourneys.values()) {
      if (handle.journeyType === journeyType && handle.isActive) {
        latest = handle;
      }
    }
    return latest;
  }

  cancelAll(): void {
    // Snapshot values to avoid mutation during iteration
    const handles = [...this.activeJourneys.values()];
    for (const handle of handles) {
      handle.end('canceled');
    }
  }

  // -----------------------------------------------------------------------
  // Visibility & unload tracking
  // -----------------------------------------------------------------------

  private setupVisibilityTracking(): void {
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.tabHiddenAt = Date.now();
    } else if (this.tabHiddenAt !== null) {
      const hiddenDuration = Date.now() - this.tabHiddenAt;
      this.tabHiddenAt = null;

      if (hiddenDuration > ABANDONED_TAB_HIDDEN_MS) {
        const handles = [...this.activeJourneys.values()];
        for (const handle of handles) {
          handle.end('abandoned');
        }
      }
    }
  };

  private setupBeforeUnload(): void {
    window.addEventListener('beforeunload', this.onBeforeUnload);
  }

  private onBeforeUnload = (): void => {
    const handles = [...this.activeJourneys.values()];
    for (const handle of handles) {
      handle.end('abandoned');
    }
  };

  /** Exposed for tests to clean up global listeners. */
  destroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
  }
}

// ---------------------------------------------------------------------------
// JourneyHandleImpl
// ---------------------------------------------------------------------------

class JourneyHandleImpl implements JourneyHandle {
  readonly journeyId: string;
  readonly traceId: string;
  readonly journeyType: string;

  /** Exposed internally for concurrent-journey span links. */
  readonly span: Span | null;

  private active = true;
  private readonly startTime: number;
  private stepCount = 0;
  private attributes: Record<string, string>;
  private readonly tracer: Tracer | null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null;
  private readonly onCleanup: () => void;
  private readonly onEndCallbacks: Array<() => void> = [];
  /**
   * Step handles that have been started but not ended. Closed by the journey at end()
   * so a journey that times out / is canceled mid-step doesn't leave dangling spans.
   */
  private readonly pendingSteps = new Set<StepHandleImpl>();

  constructor(
    journeyType: string,
    tracer: Tracer | null,
    attributes: Record<string, string>,
    concurrentLinks: Link[],
    timeoutMs: number,
    onCleanup: () => void,
    parentSpan: Span | null = null
  ) {
    this.journeyType = journeyType;
    this.tracer = tracer;
    this.attributes = { ...attributes };
    this.onCleanup = onCleanup;
    this.startTime = performance.now();

    // Create the span for the journey. When a parent journey is active and this
    // journey type declares it as a parent, the span is created under the parent
    // span's context — same trace, native Tempo waterfall. Otherwise the span is
    // a new trace root.
    if (tracer) {
      const spanOptions = {
        attributes: {
          'journey.type': journeyType,
          ...attributes,
        },
        links: concurrentLinks,
        ...(parentSpan ? {} : { root: true }),
      } as const;

      if (parentSpan) {
        const parentCtx = trace.setSpan(context.active(), parentSpan);
        this.span = tracer.startSpan(`journey:${journeyType}`, spanOptions, parentCtx);
      } else {
        this.span = tracer.startSpan(`journey:${journeyType}`, spanOptions);
      }
      const ctx = this.span.spanContext();
      // Use spanId for the journey instance id. Nested journeys share their parent's
      // traceId so traceId would collide in activeJourneys / cleanup maps; spanId is
      // unique per journey instance. traceId is exposed separately for trace deep-links.
      this.journeyId = ctx.spanId;
      this.traceId = ctx.traceId;
    } else {
      this.span = null;
      this.journeyId = uuidv4();
      this.traceId = '';
    }

    // Set up timeout
    this.timeoutTimer = setTimeout(() => {
      this.end('timeout');
    }, timeoutMs);
  }

  get isActive(): boolean {
    return this.active;
  }

  recordEvent(name: string, stepAttributes?: Record<string, string>): void {
    if (!this.active) {
      return;
    }

    this.stepCount++;
    debugLog('recordEvent', `${this.journeyType}/${name}`, {
      journeyId: this.journeyId,
      stepNumber: this.stepCount,
      attributes: stepAttributes,
    });

    if (this.tracer && this.span) {
      const parentCtx = trace.setSpan(context.active(), this.span);
      const childSpan = this.tracer.startSpan(
        `step:${name}`,
        {
          attributes: {
            'step.name': name,
            ...stepAttributes,
          },
        },
        parentCtx
      );
      // Point-in-time event: end immediately so the span is never left dangling.
      childSpan.end();
    }
  }

  startStep(name: string, stepAttributes?: Record<string, string>): StepHandle {
    if (!this.active) {
      return NOOP_STEP_INTERNAL;
    }

    this.stepCount++;
    debugLog('startStep', `${this.journeyType}/${name}`, {
      journeyId: this.journeyId,
      stepNumber: this.stepCount,
      attributes: stepAttributes,
    });

    if (this.tracer && this.span) {
      const parentCtx = trace.setSpan(context.active(), this.span);
      const childSpan = this.tracer.startSpan(
        `step:${name}`,
        {
          attributes: {
            'step.name': name,
            ...stepAttributes,
          },
        },
        parentCtx
      );
      const stepHandle = new StepHandleImpl(childSpan, () => this.pendingSteps.delete(stepHandle));
      this.pendingSteps.add(stepHandle);
      return stepHandle;
    }

    return NOOP_STEP_INTERNAL;
  }

  end(outcome: JourneyOutcome, endAttributes?: Record<string, string>): void {
    if (!this.active) {
      return;
    }

    this.active = false;
    debugLog('end', `${this.journeyType} -> ${outcome}`, {
      journeyId: this.journeyId,
      durationMs: Math.round(performance.now() - this.startTime),
      stepCount: this.stepCount,
      attributes: { ...this.attributes, ...endAttributes },
    });

    if (this.timeoutTimer !== null) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    const totalDuration = performance.now() - this.startTime;
    const allAttributes = { ...this.attributes, ...endAttributes };

    // Close any duration steps that haven't been ended explicitly. Otherwise their
    // child spans dangle and never reach Tempo. Callers should still match their own
    // start/end events; this is a backstop for timeout / cancel / abandon paths.
    if (this.pendingSteps.size > 0) {
      for (const step of [...this.pendingSteps]) {
        step.endByJourney(outcome);
      }
      this.pendingSteps.clear();
    }

    // End the OTel span
    if (this.span) {
      this.span.setAttributes(allAttributes);
      this.span.setAttribute('journey.outcome', outcome);
      this.span.setAttribute('journey.step_count', this.stepCount);
      this.span.setAttribute('journey.duration_ms', totalDuration);
      if (outcome === 'error') {
        this.span.setStatus({ code: SpanStatusCode.ERROR });
      }
      this.span.end();
    }

    // Emit measurement via Faro
    logMeasurement(
      'journey_complete',
      {
        totalDuration,
        stepCount: this.stepCount,
      },
      {
        journeyType: this.journeyType,
        journeyId: this.journeyId,
        traceId: this.traceId,
        outcome,
        ...allAttributes,
      }
    );

    this.onCleanup();

    // Run registered onEnd callbacks (e.g., end-trigger cleanup from the registry).
    // Isolate each callback so a throwing subscriber doesn't leak the rest -
    // this list owns Echo onInteraction unsubscribes, so we can't afford to skip any.
    for (const cb of this.onEndCallbacks) {
      try {
        cb();
      } catch (err) {
        console.error(`[JourneyTracker] onEnd callback error for "${this.journeyType}":`, err);
      }
    }
  }

  onEnd(callback: () => void): void {
    if (!this.active) {
      // Already ended - call immediately
      callback();
      return;
    }
    this.onEndCallbacks.push(callback);
  }

  setAttributes(attrs: Record<string, string>): void {
    if (!this.active) {
      return;
    }
    debugLog('setAttributes', this.journeyType, attrs);
    Object.assign(this.attributes, attrs);
    if (this.span) {
      this.span.setAttributes(attrs);
    }
  }
}

// ---------------------------------------------------------------------------
// StepHandleImpl
// ---------------------------------------------------------------------------

class StepHandleImpl implements StepHandle {
  private ended = false;

  constructor(
    private readonly span: Span,
    private readonly onEnd: () => void
  ) {}

  end(attributes?: Record<string, string>): void {
    if (this.ended) {
      return;
    }
    this.ended = true;
    if (attributes) {
      this.span.setAttributes(attributes);
    }
    this.span.end();
    this.onEnd();
  }

  /**
   * Called by the journey when it ends with a still-open step. Marks the step as
   * unfinished (so the duration is honest) and closes the span. Idempotent.
   */
  endByJourney(journeyOutcome: JourneyOutcome): void {
    if (this.ended) {
      return;
    }
    this.ended = true;
    this.span.setAttribute('step.outcome', 'unended');
    this.span.setAttribute('step.unended_journey_outcome', journeyOutcome);
    this.span.end();
    this.onEnd();
  }
}

/** No-op step handle used when OTel is off or journey is already ended. */
class NoopStepHandleInternal implements StepHandle {
  end(): void {}
}

const NOOP_STEP_INTERNAL = new NoopStepHandleInternal();
