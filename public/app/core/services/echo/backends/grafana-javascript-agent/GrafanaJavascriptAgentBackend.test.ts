import { BuildInfo } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/src/types/config';
import { Faro, Instrumentation } from '@grafana/faro-core';
import * as faroWebSdkModule from '@grafana/faro-web-sdk';
import { BrowserConfig, FetchTransport } from '@grafana/faro-web-sdk';

import { EchoSrvTransport } from './EchoSrvTransport';
import { GrafanaJavascriptAgentBackend, GrafanaJavascriptAgentBackendOptions } from './GrafanaJavascriptAgentBackend';

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

    initializeFaroMock = jest.spyOn(faroWebSdkModule, 'initializeFaro').mockReturnValueOnce({
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
    version: '1.0',
    commit: 'abcd123',
    env: 'production',
    versionString: 'Grafana v1.0 (abcd123)',
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
    tracingInstrumentalizationEnabled: true,
    customEndpoint: '/log-grafana-javascript-agent',
    user: {
      email: 'darth.vader@sith.glx',
      id: '504',
      orgId: 1,
    },
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
    expect(initializeFaroMock.mock.calls[0][0].transports?.[1]).toBeInstanceOf(FetchTransport);
  });

  it('will initialize GrafanaJavascriptAgent and set user', async () => {
    //act
    new GrafanaJavascriptAgentBackend(options);

    //assert
    expect(initializeFaroMock).toHaveBeenCalledTimes(1);
    expect(mockedSetUser).toHaveBeenCalledTimes(1);
    expect(mockedSetUser).toHaveBeenCalledWith({
      id: '504',
      attributes: {
        orgId: '1',
      },
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
