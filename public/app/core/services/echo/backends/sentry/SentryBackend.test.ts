import { init as initSentry, setUser as sentrySetUser, Event as SentryEvent } from '@sentry/browser';
import { SentryEchoBackend, SentryEchoBackendOptions } from './SentryBackend';
import { BuildInfo } from '@grafana/data';
import { FetchTransport } from '@sentry/browser/dist/transports';
import { CustomEndpointTransport } from './transports/CustomEndpointTransport';
import { EchoSrvTransport } from './transports/EchoSrvTransport';
import { SentryEchoEvent } from './types';
import { EchoEventType, EchoMeta } from '@grafana/runtime';

jest.mock('@sentry/browser');

describe('SentryEchoBackend', () => {
  beforeEach(() => jest.resetAllMocks());

  const buildInfo: BuildInfo = {
    version: '1.0',
    commit: 'abcd123',
    isEnterprise: false,
    env: 'production',
    edition: "Director's cut",
    latestVersion: 'ba',
    hasUpdate: false,
    hideVersion: false,
  };

  const options: SentryEchoBackendOptions = {
    enabled: true,
    buildInfo,
    dsn: 'https://examplePublicKey@o0.ingest.testsentry.io/0',
    sampleRate: 0.5,
    customEndpoint: '',
    user: {
      email: 'darth.vader@sith.glx',
      id: 504,
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
      payload: ({ foo: 'bar' } as unknown) as SentryEvent,
      meta: ({} as unknown) as EchoMeta,
    };
    backend.addEvent(event);
    backend.transports.forEach(transport => {
      expect(transport.sendEvent).toHaveBeenCalledTimes(1);
      expect(transport.sendEvent).toHaveBeenCalledWith(event.payload);
    });
  });
});
