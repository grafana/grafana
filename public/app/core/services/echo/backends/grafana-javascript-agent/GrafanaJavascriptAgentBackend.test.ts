import { BuildInfo } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { Faro, Instrumentation } from '@grafana/faro-core';
import * as faroWebSdkModule from '@grafana/faro-web-sdk';
import {
  BrowserConfig,
  FetchTransport,
  SessionInstrumentation,
  UserActionInstrumentation,
  ErrorsInstrumentation,
  WebVitalsInstrumentation,
  ViewInstrumentation,
} from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

import { EchoSrvTransport } from './EchoSrvTransport';
import { GrafanaJavascriptAgentBackend, TRACKING_URLS } from './GrafanaJavascriptAgentBackend';
import { GrafanaJavascriptAgentBackendOptions } from './types';

describe('GrafanaJavascriptAgentEchoBackend', () => {
  let mockedSetUser: jest.Mock;
  let initializeFaroMock: jest.SpyInstance<Faro, [config: BrowserConfig]>;

  beforeEach(() => {
    // arrange
    mockedSetUser = jest.fn();
    const mockedInstrumentationsForConfig: Instrumentation[] = [];
    const mockedInstrumentations = {
      add: jest.fn(),
      instrumentations: mockedInstrumentationsForConfig,
      remove: jest.fn(),
    };
    const mockedInternalLogger = {
      prefix: 'Faro',
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    initializeFaroMock = jest.spyOn(faroWebSdkModule, 'initializeFaro').mockReturnValue({
      ...faroWebSdkModule.faro,
      api: {
        ...faroWebSdkModule.faro.api,
        setUser: mockedSetUser,
      },
      config: {
        ...faroWebSdkModule.faro.config,
        instrumentations: mockedInstrumentationsForConfig,
      },
      instrumentations: mockedInstrumentations,
      internalLogger: mockedInternalLogger,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    jest.clearAllMocks();
  });

  const buildInfo: BuildInfo = {
    buildstamp: 12345,
    version: '1.0',
    commit: 'abcd123',
    commitShort: 'abc',
    env: 'production',
    versionString: 'Grafana v1.0 (abcd123)',
    edition: GrafanaEdition.OpenSource,
    latestVersion: 'ba',
    hasUpdate: false,
    hideVersion: false,
  };

  const options: GrafanaJavascriptAgentBackendOptions = {
    customEndpoint: '/log-grafana-javascript-agent',

    webVitalsAttribution: true,
    consoleInstrumentalizationEnabled: true,
    performanceInstrumentalizationEnabled: true,
    cspInstrumentalizationEnabled: true,
    tracingInstrumentalizationEnabled: true,

    buildInfo: buildInfo,
    userIdentifier: 'abc123',
    ignoreUrls: [],
    botFilterEnabled: false,
  };

  it('will set up FetchTransport if customEndpoint is provided', () => {
    // arrange
    const constructorSpy = jest.spyOn(faroWebSdkModule, 'FetchTransport');

    //act
    new GrafanaJavascriptAgentBackend(options);

    //assert
    expect(constructorSpy).toHaveBeenCalledTimes(1);
    expect(initializeFaroMock).toHaveBeenCalledTimes(1);
    expect(initializeFaroMock.mock.calls[0][0].transports?.length).toEqual(2);
    expect(initializeFaroMock.mock.calls[0][0].transports?.[0]).toBeInstanceOf(EchoSrvTransport);
    expect(initializeFaroMock.mock.calls[0][0].transports?.[0].getIgnoreUrls()).toEqual([
      /.*\/log-grafana-javascript-agent.*/,
      /\.(google-analytics|googletagmanager)\.com/,
      /frontend-metrics/,
      /\/collect(?:\/[\w]*)?$/,
    ]);
    expect(initializeFaroMock.mock.calls[0][0].transports?.[1]).toBeInstanceOf(FetchTransport);
  });

  it('will initialize GrafanaJavascriptAgent and set user', async () => {
    //act
    new GrafanaJavascriptAgentBackend(options);

    //assert
    expect(initializeFaroMock).toHaveBeenCalledTimes(1);
    expect(initializeFaroMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user: {
          id: 'abc123',
        },
      })
    );
  });

  test('will ensure the performance of TRACKING_URLS', async () => {
    // 10e6 is based on true events
    const longString = Array.from({ length: 10e6 }, () => Math.random().toString(36)[2]).join('');
    const maxExecutionTime = 500;

    const start = performance.now();
    TRACKING_URLS.some((u) => u && longString.match(u) !== null);
    const end = performance.now();
    expect(end - start).toBeLessThanOrEqual(maxExecutionTime);
  });

  it('correctly set instrumentation based on options', async () => {
    let opts = {
      ...options,
      consoleInstrumentalizationEnabled: false,
      performanceInstrumentalizationEnabled: false,
      cspInstrumentalizationEnabled: false,
      tracingInstrumentalizationEnabled: false,
    };
    new GrafanaJavascriptAgentBackend(opts);

    let lastInstrumentations = initializeFaroMock.mock.calls.at(-1)?.[0].instrumentations;
    expect(lastInstrumentations).toHaveLength(5);
    expect(lastInstrumentations).toEqual(
      expect.arrayContaining([
        expect.any(SessionInstrumentation),
        expect.any(UserActionInstrumentation),
        expect.any(ErrorsInstrumentation),
        expect.any(WebVitalsInstrumentation),
        expect.any(ViewInstrumentation),
      ])
    );

    opts.tracingInstrumentalizationEnabled = true;
    new GrafanaJavascriptAgentBackend(opts);
    lastInstrumentations = initializeFaroMock.mock.calls.at(-1)?.[0].instrumentations;
    expect(lastInstrumentations).toHaveLength(6);
    expect(lastInstrumentations).toEqual(
      expect.arrayContaining([
        expect.any(SessionInstrumentation),
        expect.any(UserActionInstrumentation),
        expect.any(ErrorsInstrumentation),
        expect.any(WebVitalsInstrumentation),
        expect.any(ViewInstrumentation),
        expect.any(TracingInstrumentation),
      ])
    );
  });

  it('should use a beforeSend handler', () => {
    new GrafanaJavascriptAgentBackend(options);

    expect(initializeFaroMock).toHaveBeenCalledTimes(1);
    expect(initializeFaroMock.mock.calls[0][0].beforeSend).toBeDefined();
  });

  //@FIXME - make integration test work

  // it('integration test with EchoSrv and  GrafanaJavascriptAgent', async () => {
  //     // sets up the whole thing between window.onerror and backend endpoint call, checks that error is reported
  //     // use actual GrafanaJavascriptAgent & mock window.fetch

  //     // arrange
  //     const originalModule = jest.requireActual('@grafana/faro-web-sdk');
  //     jest.mocked(initializeFaro).mockImplementation(originalModule.initializeFaro);
  //     const fetchSpy = (window.fetch = jest.fn());
  //     fetchSpy.mockResolvedValue({ status: 200 } as Response);
  //     const echo = new Echo({ debug: true });

  //     // act
  //     setEchoSrv(echo);
  //     const grafanaJavascriptAgentBackend = new GrafanaJavascriptAgentBackend({
  //       ...options,
  //       preventGlobalExposure: true,
  //       consoleInstrumentalizationEnabled: false,
  //       webVitalsInstrumentalizationEnabled: false,
  //     });
  //     echo.addBackend(grafanaJavascriptAgentBackend);

  //     // lets add another echo backend for grafana javascript agent events for good measure
  //     const myCustomErrorBackend: EchoBackend = {
  //       supportedEvents: [EchoEventType.GrafanaJavascriptAgent],
  //       flush: () => {},
  //       options: {},
  //       addEvent: jest.fn(),
  //     };
  //     echo.addBackend(myCustomErrorBackend);

  //     // fire off an error using global error handler, Grafana Javascript Agent should pick it up
  //     const error = new Error('test error');
  //     window.onerror!(error.message, undefined, undefined, undefined, error);

  //     // assert
  //     // check that error was reported to backend
  //     await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
  //     const [url, reqInit]: [string, RequestInit] = fetchSpy.mock.calls[0];
  //     expect(url).toEqual('/log-grafana-javascript-agent');
  //     // expect((JSON.parse(reqInit.body as string) as EchoEvent).exception!.values![0].value).toEqual('test error');
  //     console.log(JSON.parse(reqInit.body as string));

  //     // check that our custom backend got it too
  //     expect(myCustomErrorBackend.addEvent).toHaveBeenCalledTimes(1);
  //   });
});
