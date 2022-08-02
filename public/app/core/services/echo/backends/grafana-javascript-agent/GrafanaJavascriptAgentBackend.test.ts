import { BaseTransport } from '@grafana/agent-core';
import { FetchTransport, initializeAgent } from '@grafana/agent-web';
import { BuildInfo } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/src/types/config';
import { EchoEventType, EchoMeta } from '@grafana/runtime';

import { GrafanaJavascriptAgentBackend, GrafanaJavascriptAgentBackendOptions } from './GrafanaJavascriptAgentBackend';
import { GrafanaJavascriptAgentEchoEvent } from './types';

jest.mock('@grafana/agent-web', () => {
  const originalModule = jest.requireActual('@grafana/agent-web');
  return {
    __esModule: true,
    ...originalModule,
    initializeAgent: jest.fn(),
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
    const originalModule = jest.requireActual('@grafana/agent-web');
    jest.mocked(initializeAgent).mockImplementation(originalModule.initializeAgent);

    //act
    const backend = new GrafanaJavascriptAgentBackend(options);

    //assert
    expect(backend.transports.length).toEqual(1);
    expect(backend.transports[0]).toBeInstanceOf(FetchTransport);
  });

  it('will initialize GrafanaJavascriptAgent and set user', async () => {
    // arrange
    const mockedSetUser = jest.fn();
    const mockedAgent = () => {
      return {
        api: {
          setUser: mockedSetUser,
          pushLog: jest.fn(),
          callOriginalConsoleMethod: jest.fn(),
          pushError: jest.fn(),
          pushMeasurement: jest.fn(),
          pushTraces: jest.fn(),
          initOTEL: jest.fn(),
          getOTEL: jest.fn(),
          getTraceContext: jest.fn(),
        },
        config: {
          globalObjectKey: '',
          instrumentations: [],
          preventGlobalExposure: false,
          transports: [],
          metas: [],
          parseStacktrace: jest.fn(),
          app: jest.fn(),
          paused: false,
        },
        metas: {
          add: jest.fn(),
          remove: jest.fn(),
          value: {},
        },
        transports: {
          add: jest.fn(),
          execute: jest.fn(),
          transports: [],
          pause: jest.fn(),
          unpause: jest.fn(),
        },
        pause: jest.fn(),
        unpause: jest.fn(),
      };
    };
    jest.mocked(initializeAgent).mockImplementation(mockedAgent);

    //act
    new GrafanaJavascriptAgentBackend(options);

    //assert
    expect(initializeAgent).toHaveBeenCalledTimes(1);
    expect(mockedSetUser).toHaveBeenCalledTimes(1);
    expect(mockedSetUser).toHaveBeenCalledWith({
      id: '504',
      email: 'darth.vader@sith.glx',
      attributes: {
        orgId: '1',
      },
    });
  });

  it('will forward events to transports', async () => {
    //arrange
    const mockedSetUser = jest.fn();
    const mockedAgent = () => {
      return {
        api: {
          setUser: mockedSetUser,
          pushLog: jest.fn(),
          callOriginalConsoleMethod: jest.fn(),
          pushError: jest.fn(),
          pushMeasurement: jest.fn(),
          pushTraces: jest.fn(),
          initOTEL: jest.fn(),
          getOTEL: jest.fn(),
          getTraceContext: jest.fn(),
        },
        config: {
          globalObjectKey: '',
          instrumentations: [],
          preventGlobalExposure: false,
          transports: [],
          metas: [],
          parseStacktrace: jest.fn(),
          app: jest.fn(),
          paused: false,
        },
        metas: {
          add: jest.fn(),
          remove: jest.fn(),
          value: {},
        },
        transports: {
          add: jest.fn(),
          execute: jest.fn(),
          transports: [],
          pause: jest.fn(),
          unpause: jest.fn(),
        },
        pause: jest.fn(),
        unpause: jest.fn(),
      };
    };

    jest.mocked(initializeAgent).mockImplementation(mockedAgent);
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
  //     const originalModule = jest.requireActual('@grafana/agent-web');
  //     jest.mocked(initializeAgent).mockImplementation(originalModule.initializeAgent);
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
