import { type Store } from 'redux';
import configureMockStore from 'redux-mock-store';

import { type EchoSrv, locationService, setEchoSrv } from '@grafana/runtime';
import { setStore } from 'app/store/store';

import { type Playlist } from '../../api/clients/playlist/v1';
import { type DashboardQueryResult } from '../search/service/types';

import { PlaylistSrv } from './PlaylistSrv';
import { type PlaylistItemUI } from './types';

jest.mock('./utils', () => ({
  loadDashboards: (items: PlaylistItemUI[]) =>
    Promise.resolve(
      items.map((v) => ({
        ...v,
        dashboards: [{ url: `/url/to/${v.value}` } as unknown as DashboardQueryResult],
      }))
    ),
}));

setStore(configureMockStore()({ location: {} }) as Store);

function makePlaylist(name: string, items: Array<{ type: 'dashboard_by_uid'; value: string }>): Playlist {
  return {
    apiVersion: 'playlist.grafana.app/v1',
    kind: 'Playlist',
    spec: { interval: '1s', title: `Playlist ${name}`, items },
    metadata: { name },
    status: {},
  };
}

const twoDashboards = makePlaylist('xyz', [
  { type: 'dashboard_by_uid', value: 'aaa' },
  { type: 'dashboard_by_uid', value: 'bbb' },
]);

describe('PlaylistSrv resource-view reporting', () => {
  let addEvent: jest.Mock;
  let srv: PlaylistSrv;

  const resourceViews = () =>
    addEvent.mock.calls.map((c) => c[0]).filter((e: { type: string }) => e.type === 'resource-view');

  beforeEach(() => {
    jest.useFakeTimers();
    addEvent = jest.fn();
    const echo: EchoSrv = { flush: jest.fn(), addBackend: jest.fn(), addEvent, onInteraction: jest.fn(() => () => {}) };
    setEchoSrv(echo);
    locationService.push('/playlists/play/xyz');
    srv = new PlaylistSrv();
  });

  afterEach(() => {
    srv.stop();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('reports exactly one view of the playlist when it starts', async () => {
    await srv.start(twoDashboards);

    expect(resourceViews()).toEqual([
      { type: 'resource-view', payload: { group: 'playlist.grafana.app', resource: 'playlists', name: 'xyz' } },
    ]);
  });

  it('does not report more views while cycling with next and prev, or on stop', async () => {
    await srv.start(twoDashboards);

    srv.next();
    srv.next();
    srv.prev();
    jest.advanceTimersByTime(1000); // the interval timer drives next() too
    srv.stop();

    expect(resourceViews().map((e) => e.payload.name)).toEqual(['xyz']);
  });

  it('reports the view before anything else, even for a playlist with no items', async () => {
    await srv.start(makePlaylist('empty-one', []));

    expect(resourceViews()).toEqual([
      { type: 'resource-view', payload: { group: 'playlist.grafana.app', resource: 'playlists', name: 'empty-one' } },
    ]);
  });

  it('reports one view per start, keyed by the started playlist name', async () => {
    await srv.start(twoDashboards);
    srv.stop();
    await srv.start(makePlaylist('other', [{ type: 'dashboard_by_uid', value: 'ccc' }]));

    expect(resourceViews().map((e) => e.payload.name)).toEqual(['xyz', 'other']);
  });

  it('never reports the playlist play on the meta-analytics channel', async () => {
    await srv.start(twoDashboards);

    expect(resourceViews()).toHaveLength(1);
    expect(addEvent.mock.calls.filter((c) => c[0].type === 'meta-analytics')).toEqual([]);
  });
});
