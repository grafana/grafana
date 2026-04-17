import { type Span, type Tracer, context, trace, SpanStatusCode, type Link } from '@opentelemetry/api';

import { type JourneyHandle, type JourneyOptions, type JourneyOutcome, type JourneyTracker, type StepHandle, config, logMeasurement } from '@grafana/runtime';
import { createDebugLog } from 'app/core/utils/debugLog';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const ABANDONED_TAB_HIDDEN_MS = 60 * 1000; // 60 seconds

const debugLog = createDebugLog('journeyTracker', 'JourneyTracker');

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

    // Collect links to all other active journeys for concurrent context
    const MAX_CONCURRENT_LINKS = 5;
    const concurrentLinks: Link[] = [];
    const concurrentAttributes: Record<string, string> = {};
    let concurrentIdx = 0;
    let totalConcurrent = 0;

    for (const handle of this.activeJourneys.values()) {
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

    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const mergedAttributes = { ...concurrentAttributes, ...options?.attributes };

    const handle = new JourneyHandleImpl(
      journeyType,
      this.tracer,
      mergedAttributes,
      concurrentLinks,
      timeoutMs,
      () => this.activeJourneys.delete(handle.journeyId)
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
    // Return the most recently added active journey of this type.
    // Iterate in reverse insertion order by collecting matches.
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

  constructor(
    journeyType: string,
    tracer: Tracer | null,
    attributes: Record<string, string>,
    concurrentLinks: Link[],
    timeoutMs: number,
    onCleanup: () => void
  ) {
    this.journeyType = journeyType;
    this.tracer = tracer;
    this.attributes = { ...attributes };
    this.onCleanup = onCleanup;
    this.startTime = performance.now();

    // Create the root span for the journey
    if (tracer) {
      this.span = tracer.startSpan(`journey:${journeyType}`, {
        attributes: {
          'journey.type': journeyType,
          ...attributes,
        },
        links: concurrentLinks,
        root: true,
      });
      this.journeyId = this.span.spanContext().traceId;
    } else {
      this.span = null;
      this.journeyId = crypto.randomUUID();
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
      return new StepHandleImpl(childSpan);
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

  constructor(private readonly span: Span) {}

  end(attributes?: Record<string, string>): void {
    if (this.ended) {
      return;
    }
    this.ended = true;
    if (attributes) {
      this.span.setAttributes(attributes);
    }
    this.span.end();
  }
}

/** No-op step handle used when OTel is off or journey is already ended. */
class NoopStepHandleInternal implements StepHandle {
  end(): void {}
}

const NOOP_STEP_INTERNAL = new NoopStepHandleInternal();
