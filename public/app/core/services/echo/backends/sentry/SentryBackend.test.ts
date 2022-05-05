import { init as initSentry, setUser as sentrySetUser, Event as SentryEvent } from '@sentry/browser';
import { FetchTransport } from '@sentry/browser/dist/transports';
import { waitFor } from '@testing-library/react';

import { BuildInfo } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/src/types/config';
import { EchoBackend, EchoEventType, EchoMeta, setEchoSrv } from '@grafana/runtime';

import { Echo } from '../../Echo';

import { SentryEchoBackend, SentryEchoBackendOptions } from './SentryBackend';
import { CustomEndpointTransport } from './transports/CustomEndpointTransport';
import { EchoSrvTransport } from './transports/EchoSrvTransport';
import { SentryEchoEvent } from './types';

jest.mock('@sentry/browser');

describe('SentryEchoBackend', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    window.fetch = jest.fn();
  });

  const buildInfo: BuildInfo = {
    version: '1.0',
    commit: 'abcd123',
    env: 'production',
    edition: GrafanaEdition.OpenSource,
    latestVersion: 'ba',
    hasUpdate: false,
    hideVersion: false,
  };

  const options: SentryEchoBackendOptions = {
    enabled: true,
    buildInfo,
    dsn: 'https://examplePublicKey@o0.ingest.testsentry.io/0',
    sampleRate: 1,
    customEndpoint: '',
    user: {
      email: 'darth.vader@sith.glx',
      id: 504,
      orgId: 1,
    },
  };

  it('will set up sentry`s FetchTransport if DSN is provided', async () => {
    const backend = new SentryEchoBackend(options);
    expect(backend.transports.length).toEqual(1);
    expect(backend.transports[0]).toBeInstanceOf(FetchTransport);
    expect((backend.transports[0] as FetchTransport).options.dsn).toEqual(options.dsn);
  });

  it('will set up custom endpoint transport if custom endpoint is provided', async () => {
    const backend = new SentryEchoBackend({
      ...options,
      dsn: '',
      customEndpoint: '/log',
    });
    expect(backend.transports.length).toEqual(1);
    expect(backend.transports[0]).toBeInstanceOf(CustomEndpointTransport);
    expect((backend.transports[0] as CustomEndpointTransport).options.endpoint).toEqual('/log');
  });

  it('will initialize sentry and set user', async () => {
    new SentryEchoBackend(options);
    expect(initSentry).toHaveBeenCalledTimes(1);
    expect(initSentry).toHaveBeenCalledWith({
      release: buildInfo.version,
      environment: buildInfo.env,
      dsn: options.dsn,
      sampleRate: options.sampleRate,
      transport: EchoSrvTransport,
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed',
        'Non-Error exception captured with keys',
      ],
    });
    expect(sentrySetUser).toHaveBeenCalledWith({
      email: options.user?.email,
      id: String(options.user?.id),
    });
  });

  it('will forward events to transports', async () => {
    const backend = new SentryEchoBackend(options);
    backend.transports = [{ sendEvent: jest.fn() }, { sendEvent: jest.fn() }];
    const event: SentryEchoEvent = {
      type: EchoEventType.Sentry,
      payload: { foo: 'bar' } as unknown as SentryEvent,
      meta: {} as unknown as EchoMeta,
    };
    backend.addEvent(event);
    backend.transports.forEach((transport) => {
      expect(transport.sendEvent).toHaveBeenCalledTimes(1);
      expect(transport.sendEvent).toHaveBeenCalledWith(event.payload);
    });
  });

  it('integration test with EchoSrv, Sentry and CustomFetchTransport', async () => {
    // sets up the whole thing between window.onerror and backend endpoint call, checks that error is reported

    // use actual sentry & mock window.fetch
    const sentry = jest.requireActual('@sentry/browser');
    (initSentry as jest.Mock).mockImplementation(sentry.init);
    (sentrySetUser as jest.Mock).mockImplementation(sentry.setUser);
    const fetchSpy = (window.fetch = jest.fn());
    fetchSpy.mockResolvedValue({ status: 200 } as Response);

    // set up echo srv & sentry backend
    const echo = new Echo({ debug: true });
    setEchoSrv(echo);
    const sentryBackend = new SentryEchoBackend({
      ...options,
      dsn: '',
      customEndpoint: '/log',
    });
    echo.addBackend(sentryBackend);

    // lets add another echo backend for sentry events for good measure
    const myCustomErrorBackend: EchoBackend = {
      supportedEvents: [EchoEventType.Sentry],
      flush: () => {},
      options: {},
      addEvent: jest.fn(),
    };
    echo.addBackend(myCustomErrorBackend);

    // fire off an error using global error handler, Sentry should pick it up
    const error = new Error('test error');
    window.onerror!(error.message, undefined, undefined, undefined, error);

    // check that error was reported to backend
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [url, reqInit]: [string, RequestInit] = fetchSpy.mock.calls[0];
    expect(url).toEqual('/log');
    expect((JSON.parse(reqInit.body as string) as SentryEvent).exception!.values![0].value).toEqual('test error');

    // check that our custom backend got it too
    expect(myCustomErrorBackend.addEvent).toHaveBeenCalledTimes(1);
  });
});
