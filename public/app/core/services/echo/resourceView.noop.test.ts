import * as faroWebSdk from '@grafana/faro-web-sdk';
import { type EchoBackend, EchoEventType, reportResourceView, setEchoSrv } from '@grafana/runtime';

import { Echo } from './Echo';
import { PerformanceBackend } from './backends/PerformanceBackend';
import { ApplicationInsightsBackend } from './backends/analytics/ApplicationInsightsBackend';
import { BrowserConsoleBackend } from './backends/analytics/BrowseConsoleBackend';
import { GA4EchoBackend } from './backends/analytics/GA4Backend';
import { GAEchoBackend } from './backends/analytics/GABackend';
import { PostHogBackend } from './backends/analytics/PostHogBackend';
import { RudderstackBackend } from './backends/analytics/RudderstackBackend';
import { RudderstackBackend as RudderstackV3Backend } from './backends/analytics/RudderstackV3Backend';
import { GrafanaJavascriptAgentBackend } from './backends/grafana-javascript-agent/GrafanaJavascriptAgentBackend';

// Backends normally load third-party scripts from their constructors. Stub the
// loader so the real classes can be built here without touching the network.
jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
  loadScript: jest.fn(() => new Promise(() => {})),
}));

jest.mock('../context_srv', () => ({
  contextSrv: {
    user: { id: 1, login: 'admin', isSignedIn: true, orgRole: 'Admin', orgId: 1 },
  },
}));

type NamedBackend = { name: string; backend: EchoBackend };

function buildCoreBackends(): NamedBackend[] {
  // ApplicationInsights imports its SDK through SystemJS.
  Object.assign(globalThis, { System: { import: jest.fn(() => new Promise(() => {})) } });

  jest.spyOn(faroWebSdk, 'initializeFaro').mockReturnValue({
    ...faroWebSdk.faro,
    api: { ...faroWebSdk.faro.api, setUser: jest.fn() },
    config: { ...faroWebSdk.faro.config, instrumentations: [] },
    instrumentations: { add: jest.fn(), remove: jest.fn(), instrumentations: [] },
    internalLogger: { prefix: 'Faro', debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  } as unknown as ReturnType<typeof faroWebSdk.initializeFaro>);

  return [
    { name: 'PostHog', backend: new PostHogBackend({ postHogToken: 'token' }) },
    { name: 'GA', backend: new GAEchoBackend({ googleAnalyticsId: 'UA-1' }) },
    {
      name: 'GA4',
      backend: new GA4EchoBackend({ googleAnalyticsId: 'G-1', googleAnalytics4SendManualPageViews: false }),
    },
    {
      name: 'Rudderstack',
      backend: new RudderstackBackend({ writeKey: 'k', dataPlaneUrl: 'https://rs.invalid', buildInfo: {} as never }),
    },
    {
      name: 'RudderstackV3',
      backend: new RudderstackV3Backend({ writeKey: 'k', dataPlaneUrl: 'https://rs.invalid', buildInfo: {} as never }),
    },
    { name: 'AppInsights', backend: new ApplicationInsightsBackend({ connectionString: 'InstrumentationKey=x' }) },
    { name: 'BrowserConsole', backend: new BrowserConsoleBackend() },
    { name: 'Performance', backend: new PerformanceBackend({}) },
    {
      name: 'GrafanaJavascriptAgent',
      backend: new GrafanaJavascriptAgentBackend({
        consoleInstrumentalizationEnabled: false,
        performanceInstrumentalizationEnabled: false,
        cspInstrumentalizationEnabled: false,
        tracingInstrumentalizationEnabled: false,
        buildInfo: {} as never,
        userIdentifier: 'u',
        ignoreUrls: [],
        botFilterEnabled: false,
      }),
    },
  ];
}

describe('reportResourceView without the Usage Insights plugin', () => {
  let echo: Echo;
  let backends: NamedBackend[];
  let received: Map<string, jest.SpyInstance>;
  let fetchSpy: jest.Mock;
  let beaconSpy: jest.Mock;
  let xhrOpenSpy: jest.SpyInstance;

  beforeAll(() => {
    backends = buildCoreBackends();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    echo = new Echo({ flushInterval: 60_000 });
    received = new Map();
    for (const { name, backend } of backends) {
      echo.addBackend(backend);
      received.set(
        name,
        jest.spyOn(backend, 'addEvent').mockImplementation(() => {})
      );
    }
    setEchoSrv(echo);

    fetchSpy = jest.fn(() => Promise.resolve(new Response('')));
    beaconSpy = jest.fn(() => true);
    Object.assign(globalThis, { fetch: fetchSpy });
    Object.defineProperty(navigator, 'sendBeacon', { value: beaconSpy, configurable: true, writable: true });
    xhrOpenSpy = jest.spyOn(XMLHttpRequest.prototype, 'open');
  });

  afterEach(() => {
    for (const spy of received.values()) {
      spy.mockRestore();
    }
    xhrOpenSpy.mockRestore();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('builds every core backend so the check covers their real supportedEvents', () => {
    expect(backends.map((b) => b.name)).toEqual([
      'PostHog',
      'GA',
      'GA4',
      'Rudderstack',
      'RudderstackV3',
      'AppInsights',
      'BrowserConsole',
      'Performance',
      'GrafanaJavascriptAgent',
    ]);
    // An empty supportedEvents list means "every event" in Echo, which would
    // leak resource-view; each core backend must name what it takes.
    for (const { name, backend } of backends) {
      expect({ name, count: backend.supportedEvents.length > 0 }).toEqual({ name, count: true });
    }
  });

  it('no core backend lists resource-view in supportedEvents', () => {
    const listing = backends.filter(({ backend }) => backend.supportedEvents.map(String).includes('resource-view'));
    expect(listing.map((b) => b.name)).toEqual([]);
  });

  it('delivers resource-view to none of the core backends, while a real event still reaches PostHog', () => {
    reportResourceView({ group: 'playlist.grafana.app', resource: 'playlists', name: 'p1' });
    // Control: the same Echo does deliver a meta-analytics event to PostHog, so the
    // wiring above is live and the silence for resource-view is meaningful.
    echo.addEvent({
      type: EchoEventType.MetaAnalytics,
      payload: { eventName: 'dashboard-view', dashboardUid: 'abc', dashboardName: 'A' },
    });
    echo.flush();

    expect(received.get('PostHog')).toHaveBeenCalledTimes(1);
    expect(received.get('PostHog')!.mock.calls[0][0].type).toBe(EchoEventType.MetaAnalytics);

    const resourceViewDeliveries = [...received.entries()]
      .filter(([, spy]) => spy.mock.calls.some((c) => c[0].type === 'resource-view'))
      .map(([name]) => name);
    expect(resourceViewDeliveries).toEqual([]);
  });

  it('a backend subscribed only to meta-analytics receives nothing for resource-view', () => {
    const metaOnly = {
      options: {},
      supportedEvents: [EchoEventType.MetaAnalytics],
      flush: jest.fn(),
      addEvent: jest.fn(),
    };
    echo.addBackend(metaOnly);

    reportResourceView({ group: 'playlist.grafana.app', resource: 'playlists', name: 'p1' });
    echo.addEvent({
      type: EchoEventType.MetaAnalytics,
      payload: {
        eventName: 'data-request',
        datasourceUid: 'ds',
        datasourceName: 'ds',
        datasourceType: 't',
        duration: 1,
      },
    });

    expect(metaOnly.addEvent).toHaveBeenCalledTimes(1);
    expect(metaOnly.addEvent.mock.calls[0][0].type).toBe(EchoEventType.MetaAnalytics);
  });

  it('makes no network request when reporting and flushing a resource view', () => {
    // A catch-all backend (empty supportedEvents) proves the event really went
    // through this Echo, so the absence of requests below is not vacuous.
    const catchAll = { options: {}, supportedEvents: [], flush: jest.fn(), addEvent: jest.fn() };
    echo.addBackend(catchAll);

    reportResourceView({ group: 'playlist.grafana.app', resource: 'playlists', name: 'p1' });
    echo.flush();
    jest.runOnlyPendingTimers();

    expect(catchAll.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'resource-view',
        payload: { group: 'playlist.grafana.app', resource: 'playlists', name: 'p1' },
      })
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
    expect(xhrOpenSpy).not.toHaveBeenCalled();
  });
});
