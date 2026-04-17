import { type Span, SpanStatusCode } from '@opentelemetry/api';

import { config } from '@grafana/runtime';
import { getJourneyTracker } from '@grafana/runtime';

import { JourneyTrackerImpl } from './JourneyTrackerImpl';

// Polyfill for jsdom which lacks crypto.randomUUID
if (typeof crypto.randomUUID !== 'function') {
  Object.defineProperty(crypto, 'randomUUID', {
    value: () => '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
      (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)
    ),
  });
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLogMeasurement = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  logMeasurement: (...args: unknown[]) => mockLogMeasurement(...args),
}));

// Minimal span mock
function createMockSpan(traceId = 'abc123def456'): jest.Mocked<Span> {
  return {
    spanContext: jest.fn().mockReturnValue({ traceId, spanId: 'span-1', traceFlags: 1 }),
    setAttribute: jest.fn(),
    setAttributes: jest.fn(),
    setStatus: jest.fn(),
    end: jest.fn(),
    addEvent: jest.fn(),
    isRecording: jest.fn().mockReturnValue(true),
    recordException: jest.fn(),
    updateName: jest.fn(),
  } as unknown as jest.Mocked<Span>;
}

const mockRootSpan = createMockSpan('trace-id-root');
const mockChildSpan = createMockSpan('trace-id-root');
let rootSpanCounter = 0;

const mockStartSpan = jest.fn().mockImplementation((_name: string, _opts?: unknown, _ctx?: unknown) => {
  if (typeof _name === 'string' && _name.startsWith('journey:')) {
    // Return a unique span per journey to simulate unique traceIds.
    // Most tests rely on mockRootSpan assertions, so return it for the first call.
    // For concurrent journeys (cancelOnRestart: false), each needs its own traceId.
    rootSpanCounter++;
    if (rootSpanCounter === 1) {
      return mockRootSpan;
    }
    return createMockSpan(`trace-id-root-${rootSpanCounter}`);
  }
  return mockChildSpan;
});

jest.mock('@opentelemetry/api', () => {
  const actual = jest.requireActual('@opentelemetry/api');
  return {
    ...actual,
    trace: {
      ...actual.trace,
      getTracer: jest.fn().mockReturnValue({
        startSpan: (...args: unknown[]) => mockStartSpan(...args),
      }),
      setSpan: jest.fn().mockReturnValue({}),
    },
    context: {
      ...actual.context,
      active: jest.fn().mockReturnValue({}),
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function enableTracing() {
  (config as any).grafanaJavascriptAgent = {
    enabled: true,
    tracingInstrumentalizationEnabled: true,
  };
}

function disableTracing() {
  (config as any).grafanaJavascriptAgent = {
    enabled: false,
    tracingInstrumentalizationEnabled: false,
  };
}

function createTracker(): JourneyTrackerImpl {
  return new JourneyTrackerImpl();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JourneyTrackerImpl', () => {
  let tracker: JourneyTrackerImpl;

  beforeEach(() => {
    jest.useFakeTimers();
    mockLogMeasurement.mockClear();
    mockStartSpan.mockClear();
    mockRootSpan.end.mockClear();
    mockRootSpan.setAttributes.mockClear();
    mockRootSpan.setAttribute.mockClear();
    mockRootSpan.setStatus.mockClear();
    mockChildSpan.end.mockClear();
    mockChildSpan.setAttributes.mockClear();
    rootSpanCounter = 0;
    enableTracing();
    tracker = createTracker();
  });

  afterEach(() => {
    tracker.destroy();
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Core journey lifecycle
  // -------------------------------------------------------------------------

  it('should return an active handle from startJourney', () => {
    const handle = tracker.startJourney('dashboard_save');
    expect(handle.isActive).toBe(true);
    expect(handle.journeyType).toBe('dashboard_save');
    expect(handle.journeyId).toBe('trace-id-root');
  });

  it('should create a root OTel span for the journey', () => {
    tracker.startJourney('dashboard_save', { attributes: { dashboardUid: 'abc' } });
    expect(mockStartSpan).toHaveBeenCalledWith(
      'journey:dashboard_save',
      expect.objectContaining({
        attributes: expect.objectContaining({
          'journey.type': 'dashboard_save',
          dashboardUid: 'abc',
        }),
        root: true,
      })
    );
  });

  // -------------------------------------------------------------------------
  // Steps
  // -------------------------------------------------------------------------

  it('should create child spans for startStep', () => {
    const handle = tracker.startJourney('dashboard_save');
    handle.startStep('validate', { panelCount: '12' });

    expect(mockStartSpan).toHaveBeenCalledTimes(2); // root + child
    expect(mockStartSpan).toHaveBeenCalledWith(
      'step:validate',
      expect.objectContaining({
        attributes: expect.objectContaining({
          'step.name': 'validate',
          panelCount: '12',
        }),
      }),
      expect.anything()
    );
  });

  it('should create and auto-close a child span for recordEvent', () => {
    const handle = tracker.startJourney('dashboard_save');
    handle.recordEvent('user_clicked', { target: 'button' });

    expect(mockStartSpan).toHaveBeenCalledTimes(2); // root + child
    expect(mockStartSpan).toHaveBeenCalledWith(
      'step:user_clicked',
      expect.objectContaining({
        attributes: expect.objectContaining({
          'step.name': 'user_clicked',
          target: 'button',
        }),
      }),
      expect.anything()
    );
    // recordEvent must end the span immediately - no leak risk.
    expect(mockChildSpan.end).toHaveBeenCalledTimes(1);
  });

  it('should return a no-op step handle when startStep is called after end', () => {
    const handle = tracker.startJourney('dashboard_save');
    handle.end('success');

    // Should not throw or create a span
    const step = handle.startStep('late_step');
    expect(step).toBeDefined();
    step.end(); // safe no-op

    // Only root span + no extra child
    expect(mockStartSpan).toHaveBeenCalledTimes(1);
  });

  it('should be a no-op when recordEvent is called after end', () => {
    const handle = tracker.startJourney('dashboard_save');
    handle.end('success');

    handle.recordEvent('late_event');

    // Only root span, no child span created
    expect(mockStartSpan).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // end() and logMeasurement
  // -------------------------------------------------------------------------

  it('should emit logMeasurement with correct shape on end', () => {
    const handle = tracker.startJourney('dashboard_save', { attributes: { dashboardUid: 'xyz' } });
    handle.startStep('step1');
    handle.end('success', { savedVersion: '3' });

    expect(mockLogMeasurement).toHaveBeenCalledTimes(1);
    const [type, values, ctx] = mockLogMeasurement.mock.calls[0];
    expect(type).toBe('journey_complete');
    expect(values.totalDuration).toBeGreaterThanOrEqual(0);
    expect(values.stepCount).toBe(1);
    expect(ctx.journeyType).toBe('dashboard_save');
    expect(ctx.journeyId).toBe('trace-id-root');
    expect(ctx.outcome).toBe('success');
    expect(ctx.dashboardUid).toBe('xyz');
    expect(ctx.savedVersion).toBe('3');
  });

  it('should end the OTel span with error status on error outcome', () => {
    const handle = tracker.startJourney('dashboard_save');
    handle.end('error');

    expect(mockRootSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR });
    expect(mockRootSpan.end).toHaveBeenCalled();
  });

  it('should be idempotent - second end() is a no-op', () => {
    const handle = tracker.startJourney('dashboard_save');
    handle.end('success');
    handle.end('error');

    expect(mockLogMeasurement).toHaveBeenCalledTimes(1);
    expect(mockRootSpan.end).toHaveBeenCalledTimes(1);
    expect(handle.isActive).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Timeout
  // -------------------------------------------------------------------------

  it('should auto-end with timeout outcome after timeoutMs', () => {
    tracker.startJourney('dashboard_save', { timeoutMs: 1000 });

    jest.advanceTimersByTime(1000);

    expect(mockLogMeasurement).toHaveBeenCalledTimes(1);
    expect(mockLogMeasurement.mock.calls[0][2].outcome).toBe('timeout');
  });

  it('should use default 5 minute timeout when not specified', () => {
    tracker.startJourney('dashboard_save');

    // 4 minutes - should not have fired
    jest.advanceTimersByTime(4 * 60 * 1000);
    expect(mockLogMeasurement).not.toHaveBeenCalled();

    // 5 minutes total - should fire
    jest.advanceTimersByTime(60 * 1000);
    expect(mockLogMeasurement).toHaveBeenCalledTimes(1);
    expect(mockLogMeasurement.mock.calls[0][2].outcome).toBe('timeout');
  });

  it('should clear timeout when journey ends normally', () => {
    const handle = tracker.startJourney('dashboard_save', { timeoutMs: 1000 });
    handle.end('success');

    jest.advanceTimersByTime(2000);

    // Only one measurement (the explicit end), not the timeout
    expect(mockLogMeasurement).toHaveBeenCalledTimes(1);
    expect(mockLogMeasurement.mock.calls[0][2].outcome).toBe('success');
  });

  // -------------------------------------------------------------------------
  // cancelOnRestart
  // -------------------------------------------------------------------------

  it('should auto-end previous journey of same type with canceled when cancelOnRestart is true (default)', () => {
    const first = tracker.startJourney('dashboard_save');
    const second = tracker.startJourney('dashboard_save');

    expect(first.isActive).toBe(false);
    expect(second.isActive).toBe(true);
    expect(mockLogMeasurement).toHaveBeenCalledTimes(1);
    expect(mockLogMeasurement.mock.calls[0][2].outcome).toBe('canceled');
  });

  it('should allow concurrent same-type journeys when cancelOnRestart is false', () => {
    const first = tracker.startJourney('dashboard_save', { cancelOnRestart: false });
    const second = tracker.startJourney('dashboard_save', { cancelOnRestart: false });

    // Both should be active with separate journeyIds
    expect(first.isActive).toBe(true);
    expect(second.isActive).toBe(true);
    expect(first.journeyId).not.toBe(second.journeyId);

    // getActiveJourney returns the most recent active handle
    expect(tracker.getActiveJourney('dashboard_save')).toBe(second);

    // Ending the first handle should NOT remove the second from the map
    first.end('success');
    expect(first.isActive).toBe(false);
    expect(second.isActive).toBe(true);
    expect(tracker.getActiveJourney('dashboard_save')).toBe(second);

    // Ending the second handle should clean up completely
    second.end('success');
    expect(tracker.getActiveJourney('dashboard_save')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // getActiveJourney
  // -------------------------------------------------------------------------

  it('should return active handle, null for unknown type, and null after end', () => {
    const handle = tracker.startJourney('dashboard_save');
    expect(tracker.getActiveJourney('dashboard_save')).toBe(handle);
    expect(tracker.getActiveJourney('nonexistent')).toBeNull();
    handle.end('success');
    expect(tracker.getActiveJourney('dashboard_save')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // cancelAll
  // -------------------------------------------------------------------------

  it('should end all active journeys on cancelAll', () => {
    tracker.startJourney('dashboard_save', { cancelOnRestart: false });
    tracker.startJourney('panel_edit', { cancelOnRestart: false });

    tracker.cancelAll();

    expect(tracker.getActiveJourney('dashboard_save')).toBeNull();
    expect(tracker.getActiveJourney('panel_edit')).toBeNull();
    // Two measurements - one for each
    expect(mockLogMeasurement).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // Concurrent journey context
  // -------------------------------------------------------------------------

  it('should record concurrent journey info as attributes when starting a new journey', () => {
    tracker.startJourney('dashboard_view');
    tracker.startJourney('panel_edit');

    // panel_edit's startSpan should include concurrent context
    const panelEditCall = mockStartSpan.mock.calls.find(
      (call: unknown[]) => (call[0] as string) === 'journey:panel_edit'
    );
    expect(panelEditCall).toBeDefined();
    expect(panelEditCall![1].attributes).toMatchObject({
      concurrent_journey_0_type: 'dashboard_view',
    });
  });

  it('should include span links to concurrent journeys', () => {
    tracker.startJourney('dashboard_view');
    tracker.startJourney('panel_edit');

    const panelEditCall = mockStartSpan.mock.calls.find(
      (call: unknown[]) => (call[0] as string) === 'journey:panel_edit'
    );
    expect(panelEditCall![1].links).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // setAttributes
  // -------------------------------------------------------------------------

  it('should merge attributes via setAttributes', () => {
    const handle = tracker.startJourney('dashboard_save');
    handle.setAttributes({ dashboardUid: 'abc' });
    handle.end('success');

    expect(mockLogMeasurement.mock.calls[0][2].dashboardUid).toBe('abc');
  });

  it('should be a no-op when calling setAttributes after end', () => {
    const handle = tracker.startJourney('dashboard_save');
    handle.end('success');
    handle.setAttributes({ late: 'attr' });

    // Should not throw, span.setAttributes should not be called again after end
    expect(mockRootSpan.setAttributes).toHaveBeenCalledTimes(1); // only from end()
  });

  // -------------------------------------------------------------------------
  // OTel fallback - no tracer
  // -------------------------------------------------------------------------

  describe('without OTel tracing', () => {
    let noOtelTracker: JourneyTrackerImpl;

    beforeEach(() => {
      disableTracing();
      mockStartSpan.mockClear();
      mockLogMeasurement.mockClear();
      noOtelTracker = createTracker();
    });

    afterEach(() => {
      noOtelTracker.destroy();
    });

    it('should use crypto.randomUUID for journeyId', () => {
      const handle = noOtelTracker.startJourney('dashboard_save');
      // UUID format: 8-4-4-4-12 hex chars
      expect(handle.journeyId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should not create any OTel spans', () => {
      const handle = noOtelTracker.startJourney('dashboard_save');
      handle.startStep('step1');
      handle.end('success');

      // getTracer is called, but startSpan should not be
      // (since tracer is null in JourneyTrackerImpl when tracing is disabled)
      expect(mockStartSpan).not.toHaveBeenCalled();
    });

    it('should still emit logMeasurement', () => {
      const handle = noOtelTracker.startJourney('dashboard_save');
      handle.end('success');

      expect(mockLogMeasurement).toHaveBeenCalledTimes(1);
      expect(mockLogMeasurement.mock.calls[0][0]).toBe('journey_complete');
    });
  });

  // -------------------------------------------------------------------------
  // Visibility change handling
  // -------------------------------------------------------------------------

  describe('visibility tracking', () => {
    it('should end active journeys with abandoned when tab hidden >60s', () => {
      tracker.startJourney('dashboard_save');

      // Simulate tab hidden
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      // Advance past the threshold
      jest.advanceTimersByTime(61_000);

      // Simulate tab visible again
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(mockLogMeasurement).toHaveBeenCalledTimes(1);
      expect(mockLogMeasurement.mock.calls[0][2].outcome).toBe('abandoned');
    });

    it('should not end journeys when tab hidden <60s', () => {
      tracker.startJourney('dashboard_save');

      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      jest.advanceTimersByTime(30_000);

      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      // Journey should still be active
      expect(tracker.getActiveJourney('dashboard_save')).not.toBeNull();
      expect(mockLogMeasurement).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // beforeunload
  // -------------------------------------------------------------------------

  it('should end all active journeys on beforeunload', () => {
    tracker.startJourney('dashboard_save');
    tracker.startJourney('panel_edit');

    window.dispatchEvent(new Event('beforeunload'));

    expect(mockLogMeasurement).toHaveBeenCalledTimes(2);
    expect(mockLogMeasurement.mock.calls[0][2].outcome).toBe('abandoned');
    expect(mockLogMeasurement.mock.calls[1][2].outcome).toBe('abandoned');
  });

  // -------------------------------------------------------------------------
  // Step end
  // -------------------------------------------------------------------------

  it('should end a step span when StepHandle.end() is called', () => {
    const handle = tracker.startJourney('dashboard_save');
    const step = handle.startStep('validate');
    step.end({ result: 'ok' });

    expect(mockChildSpan.setAttributes).toHaveBeenCalledWith({ result: 'ok' });
    expect(mockChildSpan.end).toHaveBeenCalledTimes(1);
  });

  it('should make step end() idempotent', () => {
    const handle = tracker.startJourney('dashboard_save');
    const step = handle.startStep('validate');
    step.end();
    step.end();

    expect(mockChildSpan.end).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // onEnd callback error isolation
  // -------------------------------------------------------------------------

  it('should isolate throwing onEnd callbacks so later ones still run', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    const handle = tracker.startJourney('dashboard_save');

    const throwingCb = jest.fn(() => {
      throw new Error('boom');
    });
    const cleanupCb = jest.fn();

    handle.onEnd(throwingCb);
    handle.onEnd(cleanupCb);

    handle.end('success');

    expect(throwingCb).toHaveBeenCalledTimes(1);
    // Critical: the second callback (e.g. Echo unsubscribe) must still run.
    expect(cleanupCb).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[JourneyTracker] onEnd callback error'),
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Noop tracker tests
// ---------------------------------------------------------------------------

describe('NoopJourneyTracker (via getJourneyTracker when feature is off)', () => {
  it('should be truly zero-overhead', () => {
    // getJourneyTracker returns noop when no real tracker is set
    const tracker = getJourneyTracker();
    const handle = tracker.startJourney('dashboard_save');

    // Noop handle: empty identity, always inactive
    expect(handle.journeyId).toBe('');
    expect(handle.journeyType).toBe('');
    expect(handle.isActive).toBe(false);

    // startStep returns a noop step - end() doesn't throw
    const step = handle.startStep('step1');
    step.end();

    // recordEvent is also a safe no-op
    handle.recordEvent('some_event');

    // end() and setAttributes() don't throw
    handle.end('success');
    handle.setAttributes({ foo: 'bar' });

    // No active journeys
    expect(tracker.getActiveJourney('dashboard_save')).toBeNull();

    // cancelAll is safe
    tracker.cancelAll();
  });
});
