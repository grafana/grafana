import {
  type JourneyHandle,
  type JourneyMeta,
  type JourneyTracker,
  setJourneyTracker,
} from '@grafana/runtime';

import { JourneyRegistryImpl } from './JourneyRegistryImpl';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_META: JourneyMeta[] = [
  {
    type: 'test_journey',
    description: 'A test journey',
    owner: 'test-team',
    timeoutMs: 5000,
  },
  {
    type: 'another_journey',
    description: 'Another test journey',
    owner: 'test-team',
    timeoutMs: 10_000,
    cancelOnRestart: false,
  },
];

function createMockHandle(overrides?: Partial<JourneyHandle>): JourneyHandle {
  return {
    journeyId: `journey-${Math.random().toString(36).slice(2)}`,
    journeyType: 'test_journey',
    isActive: true,
    recordEvent: jest.fn(),
    startStep: jest.fn(),
    end: jest.fn(),
    setAttributes: jest.fn(),
    onEnd: jest.fn(),
    ...overrides,
  };
}

function createMockTracker(): jest.Mocked<JourneyTracker> {
  const handles = new Map<string, JourneyHandle>();

  return {
    startJourney: jest.fn((type, options) => {
      const handle = createMockHandle({ journeyType: type });
      handles.set(type, handle);
      return handle;
    }),
    getActiveJourney: jest.fn((type) => handles.get(type) ?? null),
    cancelAll: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JourneyRegistryImpl', () => {
  let registry: JourneyRegistryImpl;
  let mockTracker: jest.Mocked<JourneyTracker>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockTracker = createMockTracker();
    setJourneyTracker(mockTracker);

    registry = new JourneyRegistryImpl();
    registry.init(TEST_META);
  });

  afterEach(() => {
    registry.destroy();
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // init and metadata
  // -------------------------------------------------------------------------


  // -------------------------------------------------------------------------
  // registerTriggers - validation
  // -------------------------------------------------------------------------

  it('should throw when registering start for unknown journey type', () => {
    const triggersFn = jest.fn<() => void, [JourneyTracker]>(() => jest.fn());

    expect(() => registry.registerTriggers('unknown_type', triggersFn)).toThrow(
      /unknown journey type "unknown_type"/
    );
    expect(triggersFn).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // registerTriggers - execution
  // -------------------------------------------------------------------------

  it('should call triggersFn immediately with a wrapped tracker', () => {
    const triggersFn = jest.fn<() => void, [JourneyTracker]>(() => jest.fn());
    registry.registerTriggers('test_journey', triggersFn);

    expect(triggersFn).toHaveBeenCalledTimes(1);
    // The argument should be a tracker-like object
    expect(triggersFn.mock.calls[0][0]).toHaveProperty('startJourney');
    expect(triggersFn.mock.calls[0][0]).toHaveProperty('getActiveJourney');
    expect(triggersFn.mock.calls[0][0]).toHaveProperty('cancelAll');
  });

  it('should merge registry timeoutMs into startJourney calls', () => {
    let capturedTracker: JourneyTracker | undefined;
    registry.registerTriggers('test_journey', (tracker) => {
      capturedTracker = tracker;
      return jest.fn();
    });

    capturedTracker!.startJourney('test_journey');

    expect(mockTracker.startJourney).toHaveBeenCalledWith('test_journey', {
      timeoutMs: 5000,
      cancelOnRestart: true,
    });
  });

  it('should allow caller options to override registry metadata', () => {
    let capturedTracker: JourneyTracker | undefined;
    registry.registerTriggers('test_journey', (tracker) => {
      capturedTracker = tracker;
      return jest.fn();
    });

    capturedTracker!.startJourney('test_journey', {
      timeoutMs: 999,
      attributes: { key: 'val' },
    });

    expect(mockTracker.startJourney).toHaveBeenCalledWith('test_journey', {
      timeoutMs: 999,
      cancelOnRestart: true,
      attributes: { key: 'val' },
    });
  });

  it('should use cancelOnRestart from registry metadata', () => {
    let capturedTracker: JourneyTracker | undefined;
    registry.registerTriggers('another_journey', (tracker) => {
      capturedTracker = tracker;
      return jest.fn();
    });

    capturedTracker!.startJourney('another_journey');

    expect(mockTracker.startJourney).toHaveBeenCalledWith('another_journey', {
      timeoutMs: 10_000,
      cancelOnRestart: false,
    });
  });

  // -------------------------------------------------------------------------
  // onInstance - eager (at bootstrap)
  // -------------------------------------------------------------------------

  it('should call instanceFn when journey starts and instanceFn is registered', () => {
    const instanceFn = jest.fn<() => void, [JourneyHandle]>(() => jest.fn());
    registry.onInstance('test_journey', instanceFn);

    let capturedTracker: JourneyTracker | undefined;
    registry.registerTriggers('test_journey', (tracker) => {
      capturedTracker = tracker;
      return jest.fn();
    });

    // Start a journey - instanceFn should be called with the handle
    capturedTracker!.startJourney('test_journey');

    expect(instanceFn).toHaveBeenCalledTimes(1);
    const handle = instanceFn.mock.calls[0][0];
    expect(handle.journeyType).toBe('test_journey');
  });

  // -------------------------------------------------------------------------
  // onInstance - lazy (late registration with buffering)
  // -------------------------------------------------------------------------

  it('should buffer handles when instanceFn is not yet registered', () => {
    let capturedTracker: JourneyTracker | undefined;
    registry.registerTriggers('test_journey', (tracker) => {
      capturedTracker = tracker;
      return jest.fn();
    });

    // Start a journey before instanceFn is registered
    capturedTracker!.startJourney('test_journey');

    // Now register instanceFn - should replay the buffered handle
    const instanceFn = jest.fn<() => void, [JourneyHandle]>(() => jest.fn());
    registry.onInstance('test_journey', instanceFn);

    expect(instanceFn).toHaveBeenCalledTimes(1);
    const handle = instanceFn.mock.calls[0][0];
    expect(handle.journeyType).toBe('test_journey');
  });

  it('should not replay inactive buffered handles', () => {
    let capturedTracker: JourneyTracker | undefined;
    registry.registerTriggers('test_journey', (tracker) => {
      capturedTracker = tracker;
      return jest.fn();
    });

    // Start a journey
    const handle = capturedTracker!.startJourney('test_journey');
    // End it before instanceFn is registered
    handle.end('success');

    // Mock isActive to return false
    Object.defineProperty(handle, 'isActive', { value: false });

    // Register instanceFn - should NOT replay since handle is inactive
    const instanceFn = jest.fn<() => void, [JourneyHandle]>(() => jest.fn());
    registry.onInstance('test_journey', instanceFn);

    expect(instanceFn).not.toHaveBeenCalled();
  });

  it('should clean up buffered handles on timeout', () => {
    let capturedTracker: JourneyTracker | undefined;
    registry.registerTriggers('test_journey', (tracker) => {
      capturedTracker = tracker;
      return jest.fn();
    });

    // Start a journey (timeoutMs = 5000 from metadata)
    capturedTracker!.startJourney('test_journey');

    // Advance past the timeout
    jest.advanceTimersByTime(5001);

    // Now register instanceFn - should NOT replay since buffer was cleaned
    const instanceFn = jest.fn<() => void, [JourneyHandle]>(() => jest.fn());
    registry.onInstance('test_journey', instanceFn);

    expect(instanceFn).not.toHaveBeenCalled();
  });

  it('should use effective (caller-override) timeout for buffer eviction', () => {
    let capturedTracker: JourneyTracker | undefined;
    registry.registerTriggers('test_journey', (tracker) => {
      capturedTracker = tracker;
      return jest.fn();
    });

    // Caller overrides timeout to 1000 (registry default is 5000)
    capturedTracker!.startJourney('test_journey', { timeoutMs: 1000 });

    // Advance past the effective (caller) timeout but before the registry default
    jest.advanceTimersByTime(1001);

    const instanceFn = jest.fn<() => void, [JourneyHandle]>(() => jest.fn());
    registry.onInstance('test_journey', instanceFn);

    // Buffer should be cleared since caller's 1000 ms elapsed
    expect(instanceFn).not.toHaveBeenCalled();
  });

  it('should evict buffered handle when it ends naturally before timeout', () => {
    // Collect onEnd callbacks registered on the buffered handle so we can fire them.
    const onEndCallbacks: Array<() => void> = [];
    const customTracker: jest.Mocked<JourneyTracker> = {
      startJourney: jest.fn((type) => ({
        journeyId: `journey-${type}`,
        journeyType: type,
        isActive: true,
        recordEvent: jest.fn(),
        startStep: jest.fn(),
        end: jest.fn(),
        setAttributes: jest.fn(),
        onEnd: jest.fn((cb: () => void) => onEndCallbacks.push(cb)),
      })),
      getActiveJourney: jest.fn(),
      cancelAll: jest.fn(),
    };
    setJourneyTracker(customTracker);

    let capturedTracker: JourneyTracker | undefined;
    registry.registerTriggers('test_journey', (tracker) => {
      capturedTracker = tracker;
      return jest.fn();
    });

    capturedTracker!.startJourney('test_journey');

    // Simulate the handle ending naturally - onEnd callbacks fire.
    expect(onEndCallbacks.length).toBeGreaterThan(0);
    onEndCallbacks.forEach((cb) => cb());

    // Now register instanceFn - buffer should be empty (not just pending timer).
    const instanceFn = jest.fn<() => void, [JourneyHandle]>(() => jest.fn());
    registry.onInstance('test_journey', instanceFn);

    expect(instanceFn).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // onInstance - validation
  // -------------------------------------------------------------------------

  it('should throw when registering end for unknown journey type', () => {
    const instanceFn = jest.fn<() => void, [JourneyHandle]>(() => jest.fn());

    expect(() => registry.onInstance('unknown_type', instanceFn)).toThrow(
      /unknown journey type "unknown_type"/
    );
    expect(instanceFn).not.toHaveBeenCalled();
  });

  it('should throw when registering a duplicate end handler for the same journey type', () => {
    const instanceFn1 = jest.fn<() => void, [JourneyHandle]>(() => jest.fn());
    const instanceFn2 = jest.fn<() => void, [JourneyHandle]>(() => jest.fn());

    registry.onInstance('test_journey', instanceFn1);

    expect(() => registry.onInstance('test_journey', instanceFn2)).toThrow(
      /already has an end handler registered/
    );
  });

  // -------------------------------------------------------------------------
  // warnUnregistered
  // -------------------------------------------------------------------------

  it('should warn for registry entries with no start trigger registered', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Only register start for test_journey, not another_journey
    registry.registerTriggers('test_journey', () => jest.fn());
    registry.warnUnregistered();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"another_journey" has no triggers registered'));

    warnSpy.mockRestore();
  });

  it('should not warn when all registry entries have start triggers registered', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    registry.registerTriggers('test_journey', () => jest.fn());
    registry.registerTriggers('another_journey', () => jest.fn());
    registry.warnUnregistered();

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // destroy
  // -------------------------------------------------------------------------

  it('should clean up all subscriptions on destroy', () => {
    const startCleanup = jest.fn();
    const endCleanup = jest.fn();

    registry.registerTriggers('test_journey', () => startCleanup);
    registry.onInstance('test_journey', () => endCleanup);

    // Start a journey to trigger instanceFn
    let capturedTracker: JourneyTracker | undefined;
    registry.destroy(); // Destroy first registry

    // Create fresh registry
    registry = new JourneyRegistryImpl();
    registry.init(TEST_META);

    const startCleanup2 = jest.fn();
    registry.registerTriggers('test_journey', (tracker) => {
      capturedTracker = tracker;
      return startCleanup2;
    });

    const endCleanup2 = jest.fn();
    registry.onInstance('test_journey', () => endCleanup2);

    capturedTracker!.startJourney('test_journey');

    registry.destroy();

    expect(startCleanup2).toHaveBeenCalledTimes(1);
    expect(endCleanup2).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Multiple journeys
  // -------------------------------------------------------------------------

  it('should handle multiple journey types independently', () => {
    let trackerA: JourneyTracker | undefined;
    let trackerB: JourneyTracker | undefined;

    registry.registerTriggers('test_journey', (tracker) => {
      trackerA = tracker;
      return jest.fn();
    });

    registry.registerTriggers('another_journey', (tracker) => {
      trackerB = tracker;
      return jest.fn();
    });

    const instanceFnA = jest.fn<() => void, [JourneyHandle]>(() => jest.fn());
    const instanceFnB = jest.fn<() => void, [JourneyHandle]>(() => jest.fn());

    registry.onInstance('test_journey', instanceFnA);
    registry.onInstance('another_journey', instanceFnB);

    trackerA!.startJourney('test_journey');
    trackerB!.startJourney('another_journey');

    expect(instanceFnA).toHaveBeenCalledTimes(1);
    expect(instanceFnB).toHaveBeenCalledTimes(1);
    expect(instanceFnA.mock.calls[0][0].journeyType).toBe('test_journey');
    expect(instanceFnB.mock.calls[0][0].journeyType).toBe('another_journey');
  });
});
