import { State } from 'centrifuge';
import { of, lastValueFrom, toArray } from 'rxjs';

import {
  type LiveChannelEvent,
  LiveChannelConnectionState,
  LiveChannelScope,
  isLiveChannelStatusEvent,
} from '@grafana/data';

import { CentrifugeService, type CentrifugeSrvDeps } from './service';

// ---------------------------------------------------------------------------
// Centrifuge mock
// ---------------------------------------------------------------------------

let mockCentrifugeState = State.Disconnected;

const mockCentrifuge = {
  get state() {
    return mockCentrifugeState;
  },
  connect: jest.fn(),
  on: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  newSubscription: jest.fn(() => mockSubscription),
  getSubscription: jest.fn(() => null),
  removeSubscription: jest.fn(),
  rpc: jest.fn(),
};

const mockSubscription = {
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  removeAllListeners: jest.fn(),
  publish: jest.fn(),
  presence: jest.fn(),
  on: jest.fn().mockReturnThis(),
};

jest.mock('centrifuge', () => ({
  ...jest.requireActual('centrifuge'),
  Centrifuge: jest.fn(() => mockCentrifuge),
}));

// Suppress getBackendSrv usage inside onError handler
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(() => ({ get: jest.fn() })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseAddr = {
  scope: LiveChannelScope.Grafana,
  stream: 'teststream',
  path: 'testpath',
};

function makeDeps(overrides: Partial<CentrifugeSrvDeps> = {}): CentrifugeSrvDeps {
  return {
    grafanaAuthToken: null,
    appUrl: 'http://localhost:3000',
    namespace: 'default',
    orgRole: 'Admin',
    liveEnabled: true,
    dataStreamSubscriberReadiness: of(true),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CentrifugeService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    mockCentrifugeState = State.Disconnected;
    mockCentrifuge.on.mockClear();
    mockCentrifuge.addListener.mockClear();
    mockCentrifuge.connect.mockClear();
    mockCentrifuge.newSubscription.mockClear();
    mockCentrifuge.removeSubscription.mockClear();
    mockCentrifuge.getSubscription.mockClear();
  });

  it('should timeout and shut down channel when centrifuge never connects', async () => {
    jest.useFakeTimers();

    // centrifuge stays Disconnected — connectionBlocker never resolves
    const service = new CentrifugeService(makeDeps());

    const stream$ = service.getStream(baseAddr);

    // Collect all emitted events
    const eventsPromise = lastValueFrom(stream$.pipe(toArray()));

    // Advance past the 10s timeout
    await jest.advanceTimersByTimeAsync(10_000);

    const events = await eventsPromise;

    // Should have at least 2 status events: initial Pending, then the error
    expect(events.length).toBeGreaterThanOrEqual(2);

    const errorEvent = events.find((e) => isLiveChannelStatusEvent(e) && e.error === 'Grafana Live connection timeout');
    expect(errorEvent).toBeDefined();

    // Stream should have completed (lastValueFrom resolved)
  });

  it('should immediately shut down channel when liveEnabled is false', async () => {
    const service = new CentrifugeService(makeDeps({ liveEnabled: false }));

    const stream$ = service.getStream(baseAddr);
    const events = await lastValueFrom(stream$.pipe(toArray()));

    // Should contain the error status
    const errorEvent = events.find((e) => isLiveChannelStatusEvent(e) && e.error === 'Grafana Live is disabled');
    expect(errorEvent).toBeDefined();

    // Should NOT have created a subscription
    expect(mockCentrifuge.newSubscription).not.toHaveBeenCalled();
  });

  it('should proceed normally when centrifuge is already connected', async () => {
    // Set connected state BEFORE constructing the service so connectionBlocker resolves immediately
    mockCentrifugeState = State.Connected;

    const service = new CentrifugeService(makeDeps());

    const stream$ = service.getStream(baseAddr);

    // The stream should emit the initial Pending status and stay open (subscription created)
    const firstEvent = await new Promise<LiveChannelEvent>((resolve) => {
      stream$.subscribe({ next: resolve });
    });

    expect(isLiveChannelStatusEvent(firstEvent)).toBe(true);
    if (isLiveChannelStatusEvent(firstEvent)) {
      expect(firstEvent.state).toBe(LiveChannelConnectionState.Pending);
    }

    // initChannel should have succeeded — subscription was created
    expect(mockCentrifuge.newSubscription).toHaveBeenCalled();
    expect(mockSubscription.subscribe).toHaveBeenCalled();
  });
});
