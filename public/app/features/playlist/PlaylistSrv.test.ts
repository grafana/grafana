// @ts-ignore
import { Store } from 'redux';
import configureMockStore from 'redux-mock-store';

import { locationService } from '@grafana/runtime';
import { setStore } from 'app/store/store';

import { DashboardQueryResult } from '../search/service/types';

import { PlaylistSrv } from './PlaylistSrv';
import { Playlist, PlaylistItem } from './types';

jest.mock('./api', () => ({
  getPlaylistAPI: () => ({
    getPlaylist: jest.fn().mockReturnValue({
      interval: '1s',
      uid: 'xyz',
      name: 'The display',
      items: [
        { type: 'dashboard_by_uid', value: 'aaa' },
        { type: 'dashboard_by_uid', value: 'bbb' },
      ],
    } as Playlist),
  }),
  loadDashboards: (items: PlaylistItem[]) => {
    return Promise.resolve(
      items.map((v) => ({
        ...v, // same item with dashboard URLs filled in
        dashboards: [{ url: `/url/to/${v.value}` } as unknown as DashboardQueryResult],
      }))
    );
  },
}));

const mockStore = configureMockStore();

setStore(
  mockStore({
    location: {},
  }) as Store
);

function createPlaylistSrv(): PlaylistSrv {
  locationService.push('/playlists/foo');
  return new PlaylistSrv();
}

const mockWindowLocation = (): [jest.Mock, () => void] => {
  const oldLocation = window.location;
  const hrefMock = jest.fn();

  // JSDom defines window in a way that you cannot tamper with location so this seems to be the only way to change it.
  // https://github.com/facebook/jest/issues/5124#issuecomment-446659510
  //@ts-ignore
  delete window.location;

  window.location = {} as Location;

  // Only mocking href as that is all this test needs, but otherwise there is lots of things missing, so keep that
  // in mind if this is reused.
  Object.defineProperty(window.location, 'href', {
    set: hrefMock,
    get: hrefMock,
  });
  const unmock = () => {
    window.location = oldLocation;
  };
  return [hrefMock, unmock];
};

describe('PlaylistSrv', () => {
  let srv: PlaylistSrv;
  let hrefMock: jest.Mock;
  let unmockLocation: () => void;
  const initialUrl = 'http://localhost/playlist';

  beforeEach(() => {
    jest.clearAllMocks();

    srv = createPlaylistSrv();
    [hrefMock, unmockLocation] = mockWindowLocation();

    // This will be cached in the srv when start() is called
    hrefMock.mockReturnValue(initialUrl);
  });

  afterEach(() => {
    unmockLocation();
  });

  it('runs all dashboards in cycle and reloads page after 3 cycles', async () => {
    await srv.start('foo');

    for (let i = 0; i < 6; i++) {
      srv.next();
    }

    expect(hrefMock).toHaveBeenCalledTimes(2);
    expect(hrefMock).toHaveBeenLastCalledWith(initialUrl);
  });

  it('keeps the refresh counter value after restarting', async () => {
    await srv.start('foo');

    // 1 complete loop
    for (let i = 0; i < 3; i++) {
      srv.next();
    }

    srv.stop();
    await srv.start('foo');

    // Another 2 loops
    for (let i = 0; i < 4; i++) {
      srv.next();
    }

    expect(hrefMock).toHaveBeenCalledTimes(3);
    expect(hrefMock).toHaveBeenLastCalledWith(initialUrl);
  });

  it('Should stop playlist when navigating away', async () => {
    await srv.start('foo');

    locationService.push('/datasources');

    expect(srv.state.isPlaying).toBe(false);
  });

  it('storeUpdated should not stop playlist when navigating to next dashboard', async () => {
    await srv.start('foo');

    // eslint-disable-next-line
    expect((srv as any).validPlaylistUrl).toBe('/url/to/aaa');

    srv.next();

    // eslint-disable-next-line
    expect((srv as any).validPlaylistUrl).toBe('/url/to/bbb');
    expect(srv.state.isPlaying).toBe(true);
  });
});
