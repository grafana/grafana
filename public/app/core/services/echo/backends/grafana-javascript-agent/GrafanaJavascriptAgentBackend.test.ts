import { BuildInfo } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/src/types/config';
import { BaseTransport, Instrumentation, InternalLoggerLevel } from '@grafana/faro-core';
import { FetchTransport, initializeFaro } from '@grafana/faro-web-sdk';
import { EchoEventType, EchoMeta } from '@grafana/runtime';

import { GrafanaJavascriptAgentBackend, GrafanaJavascriptAgentBackendOptions } from './GrafanaJavascriptAgentBackend';
import { GrafanaJavascriptAgentEchoEvent } from './types';

jest.mock('@grafana/faro-web-sdk', () => {
  const originalModule = jest.requireActual('@grafana/faro-web-sdk');
  return {
    __esModule: true,
    ...originalModule,
    initializeFaro: jest.fn(),
  };
});

describe('GrafanaJavascriptAgentEchoBackend', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    window.fetch = jest.fn();
    jest.resetModules();
    jest.clearAllMocks();
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

  const options: GrafanaJavascriptAgentBackendOptions = {
    buildInfo,
    app: {
      version: '1.0',
    },
    errorInstrumentalizationEnabled: true,
    consoleInstrumentalizationEnabled: true,
    webVitalsInstrumentalizationEnabled: true,
    customEndpoint: '/log-grafana-javascript-agent',
    user: {
      email: 'darth.vader@sith.glx',
      id: '504',
      orgId: 1,
    },
  };

  it('will set up FetchTransport if customEndpoint is provided', async () => {
    // arrange
    const originalModule = jest.requireActual('@grafana/faro-web-sdk');
    jest.mocked(initializeFaro).mockImplementation(originalModule.initializeFaro);

    //act
    const backend = new GrafanaJavascriptAgentBackend(options);

    //assert
    expect(backend.transports.length).toEqual(1);
    expect(backend.transports[0]).toBeInstanceOf(FetchTransport);
  });

  it('will initialize GrafanaJavascriptAgent and set user', async () => {
    // arrange
    const mockedSetUser = jest.fn();
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
    const mockedAgent = () => {
      return {
        api: {
          setUser: mockedSetUser,
          pushLog: jest.fn(),
          callOriginalConsoleMethod: jest.fn(),
          pushError: jest.fn(),
          pushMeasurement: jest.fn(),
          pushTraces: jest.fn(),
          pushEvent: jest.fn(),
          initOTEL: jest.fn(),
          getOTEL: jest.fn(),
          getTraceContext: jest.fn(),
          changeStacktraceParser: jest.fn(),
          getStacktraceParser: jest.fn(),
          isOTELInitialized: jest.fn(),
          setSession: jest.fn(),
          getSession: jest.fn(),
          resetUser: jest.fn(),
          resetSession: jest.fn(),
        },
        config: {
          globalObjectKey: '',
          preventGlobalExposure: false,
          transports: [],
          instrumentations: mockedInstrumentationsForConfig,
          metas: [],
          parseStacktrace: jest.fn(),
          app: jest.fn(),
          paused: false,
          dedupe: true,
          isolate: false,
          internalLoggerLevel: InternalLoggerLevel.ERROR,
          unpatchedConsole: { ...console },
        },
        metas: {
          add: jest.fn(),
          remove: jest.fn(),
          value: {},
          addListener: jest.fn(),
          removeListener: jest.fn(),
        },
        transports: {
          add: jest.fn(),
          execute: jest.fn(),
          transports: [],
          pause: jest.fn(),
          unpause: jest.fn(),
          addBeforeSendHooks: jest.fn(),
          addIgnoreErrorsPatterns: jest.fn(),
          getBeforeSendHooks: jest.fn(),
          isPaused: jest.fn(),
          remove: jest.fn(),
          removeBeforeSendHooks: jest.fn(),
        },
        pause: jest.fn(),
        unpause: jest.fn(),
        instrumentations: mockedInstrumentations,
        internalLogger: mockedInternalLogger,
        unpatchedConsole: { ...console },
      };
    };
    jest.mocked(initializeFaro).mockImplementation(mockedAgent);

    //act
    new GrafanaJavascriptAgentBackend(options);

    //assert
    expect(initializeFaro).toHaveBeenCalledTimes(1);
    expect(mockedSetUser).toHaveBeenCalledTimes(1);
    expect(mockedSetUser).toHaveBeenCalledWith({
      id: '504',
      attributes: {
        orgId: '1',
      },
    });
  });

  it('will forward events to transports', async () => {
    //arrange
    const mockedSetUser = jest.fn();
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
    const mockedAgent = () => {
      return {
        api: {
          setUser: mockedSetUser,
          pushLog: jest.fn(),
          callOriginalConsoleMethod: jest.fn(),
          pushError: jest.fn(),
          pushMeasurement: jest.fn(),
          pushTraces: jest.fn(),
          pushEvent: jest.fn(),
          initOTEL: jest.fn(),
          getOTEL: jest.fn(),
          getTraceContext: jest.fn(),
          changeStacktraceParser: jest.fn(),
          getStacktraceParser: jest.fn(),
          isOTELInitialized: jest.fn(),
          setSession: jest.fn(),
          getSession: jest.fn(),
          resetUser: jest.fn(),
          resetSession: jest.fn(),
        },
        config: {
          globalObjectKey: '',
          preventGlobalExposure: false,
          transports: [],
          instrumentations: mockedInstrumentationsForConfig,
          metas: [],
          parseStacktrace: jest.fn(),
          app: jest.fn(),
          paused: false,
          dedupe: true,
          isolate: false,
          internalLoggerLevel: InternalLoggerLevel.ERROR,
          unpatchedConsole: { ...console },
        },
        metas: {
          add: jest.fn(),
          remove: jest.fn(),
          value: {},
          addListener: jest.fn(),
          removeListener: jest.fn(),
        },
        transports: {
          add: jest.fn(),
          execute: jest.fn(),
          transports: [],
          pause: jest.fn(),
          unpause: jest.fn(),
          addBeforeSendHooks: jest.fn(),
          addIgnoreErrorsPatterns: jest.fn(),
          getBeforeSendHooks: jest.fn(),
          isPaused: jest.fn(),
          remove: jest.fn(),
          removeBeforeSendHooks: jest.fn(),
        },
        pause: jest.fn(),
        unpause: jest.fn(),
        instrumentations: mockedInstrumentations,
        internalLogger: mockedInternalLogger,
        unpatchedConsole: { ...console },
      };
    };

    jest.mocked(initializeFaro).mockImplementation(mockedAgent);
    const backend = new GrafanaJavascriptAgentBackend({
      ...options,
      preventGlobalExposure: true,
    });

    backend.transports = [
      /* eslint-disable */
      { send: jest.fn() } as unknown as BaseTransport,
      { send: jest.fn() } as unknown as BaseTransport,
    ];
    const event: GrafanaJavascriptAgentEchoEvent = {
      type: EchoEventType.GrafanaJavascriptAgent,
      payload: { foo: 'bar' } as unknown as GrafanaJavascriptAgentEchoEvent,
      meta: {} as unknown as EchoMeta,
    };
    /* eslint-enable */
    backend.addEvent(event);
    backend.transports.forEach((transport) => {
      expect(transport.send).toHaveBeenCalledTimes(1);
      expect(transport.send).toHaveBeenCalledWith(event.payload);
    });
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
