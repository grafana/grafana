import * as runtime from '../index';
import type * as EchoSrvModule from '../services/EchoSrv';
import { type EchoSrv, EchoEventType, setEchoSrv } from '../services/EchoSrv';

import { MetaAnalyticsEventName, isResourceViewEvent, type ResourceViewEchoEventPayload } from './types';
import type * as UtilsModule from './utils';
import { reportResourceView } from './utils';

function recordingEchoSrv(): EchoSrv & { addEvent: jest.Mock } {
  return {
    flush: jest.fn(),
    addBackend: jest.fn(),
    addEvent: jest.fn(),
    onInteraction: jest.fn(() => () => {}),
  };
}

const playlistView: ResourceViewEchoEventPayload = {
  group: 'playlist.grafana.app',
  resource: 'playlists',
  name: 'my-playlist',
};

describe('EchoEventType.ResourceView', () => {
  it('is the string resource-view', () => {
    expect(EchoEventType.ResourceView).toBe('resource-view');
  });

  it('adds ResourceView without changing any existing member', () => {
    expect({ ...EchoEventType }).toEqual({
      Performance: 'performance',
      MetaAnalytics: 'meta-analytics',
      Pageview: 'pageview',
      Interaction: 'interaction',
      ExperimentView: 'experimentview',
      GrafanaJavascriptAgent: 'grafana-javascript-agent',
      ResourceView: 'resource-view',
    });
  });
});

describe('MetaAnalyticsEventName', () => {
  it('keeps exactly the pre-existing event names', () => {
    expect({ ...MetaAnalyticsEventName }).toEqual({
      DashboardView: 'dashboard-view',
      DataRequest: 'data-request',
    });
  });
});

describe('reportResourceView', () => {
  let echo: ReturnType<typeof recordingEchoSrv>;

  beforeEach(() => {
    echo = recordingEchoSrv();
    setEchoSrv(echo);
  });

  it('adds exactly one resource-view event with the group, resource and name as payload', () => {
    reportResourceView(playlistView);

    expect(echo.addEvent).toHaveBeenCalledTimes(1);
    expect(echo.addEvent.mock.calls[0][0]).toEqual({
      type: 'resource-view',
      payload: { group: 'playlist.grafana.app', resource: 'playlists', name: 'my-playlist' },
    });
  });

  it('sends a payload with only group, resource and name, and not on the meta-analytics channel', () => {
    reportResourceView({ ...playlistView, eventName: 'dashboard-view' } as unknown as ResourceViewEchoEventPayload);

    expect(echo.addEvent).toHaveBeenCalledTimes(1);
    const event = echo.addEvent.mock.calls[0][0];
    expect(event.type).toBe('resource-view');
    expect(event.type).not.toBe(EchoEventType.MetaAnalytics);
    expect(Object.keys(event.payload).sort()).toEqual(['group', 'name', 'resource']);
    expect(event.payload).not.toHaveProperty('eventName');
  });

  it('reports one event per call', () => {
    reportResourceView(playlistView);
    reportResourceView({ ...playlistView, name: 'other' });

    expect(echo.addEvent.mock.calls.map((c) => c[0].payload.name)).toEqual(['my-playlist', 'other']);
  });

  it.each([
    { desc: 'group missing', payload: { resource: 'playlists', name: 'p' } },
    { desc: 'resource missing', payload: { group: 'playlist.grafana.app', name: 'p' } },
    { desc: 'name missing', payload: { group: 'playlist.grafana.app', resource: 'playlists' } },
    { desc: 'group empty', payload: { group: '', resource: 'playlists', name: 'p' } },
    { desc: 'resource empty', payload: { group: 'playlist.grafana.app', resource: '', name: 'p' } },
    { desc: 'name empty', payload: { group: 'playlist.grafana.app', resource: 'playlists', name: '' } },
    { desc: 'group not a string', payload: { group: 1, resource: 'playlists', name: 'p' } },
    { desc: 'resource not a string', payload: { group: 'playlist.grafana.app', resource: {}, name: 'p' } },
    { desc: 'name not a string', payload: { group: 'playlist.grafana.app', resource: 'playlists', name: 42 } },
    { desc: 'payload undefined', payload: undefined },
    { desc: 'payload null', payload: null },
  ])('does nothing and does not throw when $desc', ({ payload }) => {
    const call = () => reportResourceView(payload as unknown as ResourceViewEchoEventPayload);

    expect(call).not.toThrow();
    expect(echo.addEvent).not.toHaveBeenCalled();
  });

  it('does not throw when no Echo service has been set, and buffers the event for the real one', () => {
    jest.isolateModules(() => {
      // A fresh module registry has no Echo service set yet.
      const echoModule: typeof EchoSrvModule = require('../services/EchoSrv');
      const utils: typeof UtilsModule = require('./utils');

      expect(() => utils.reportResourceView(playlistView)).not.toThrow();

      const fake = echoModule.getEchoSrv();
      expect(fake).toBeInstanceOf(echoModule.FakeEchoSrv);
      expect((fake as EchoSrvModule.FakeEchoSrv).buffer.map((b) => b.event)).toEqual([
        { type: 'resource-view', payload: playlistView },
      ]);
    });
  });
});

describe('isResourceViewEvent', () => {
  const meta = {} as never;

  it('is true for a resource-view event', () => {
    expect(isResourceViewEvent({ type: EchoEventType.ResourceView, payload: playlistView, meta })).toBe(true);
  });

  it('is false for a dashboard-view meta-analytics event', () => {
    expect(
      isResourceViewEvent({
        type: EchoEventType.MetaAnalytics,
        payload: { eventName: 'dashboard-view', dashboardUid: 'abc', dashboardName: 'A' },
        meta,
      })
    ).toBe(false);
  });

  it('is false for a pageview event', () => {
    expect(isResourceViewEvent({ type: EchoEventType.Pageview, payload: { page: '/playlists' }, meta })).toBe(false);
  });
});

describe('@grafana/runtime public API', () => {
  it('exports reportResourceView and isResourceViewEvent from the package entry point', () => {
    expect(runtime.reportResourceView).toBe(reportResourceView);
    expect(runtime.isResourceViewEvent).toBe(isResourceViewEvent);
    expect(runtime.EchoEventType.ResourceView).toBe('resource-view');
  });
});
