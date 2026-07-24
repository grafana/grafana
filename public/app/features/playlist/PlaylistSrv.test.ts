import { type Store } from 'redux';
import configureMockStore from 'redux-mock-store';

import { locationService } from '@grafana/runtime';
import { setStore } from 'app/store/store';

import { type Playlist } from '../../api/clients/playlist/v1';
import { type DashboardQueryResult } from '../search/service/types';

import { PlaylistSrv } from './PlaylistSrv';
import { type PlaylistItemUI } from './types';

jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
  loadDashboards: (items: PlaylistItemUI[]) => {
    return Promise.resolve(
      items.map((v) => ({
        ...v, // same item with dashboard URLs filled in
        dashboards: [{ url: `/url/to/${v.value}` } as unknown as DashboardQueryResult],
      }))
    );
  },
}));

const mockPlaylist: Playlist = {
  apiVersion: 'playlist.grafana.app/v1',
  kind: 'Playlist',
  spec: {
    interval: '1s',
    title: 'The display',
    items: [
      { type: 'dashboard_by_uid', value: 'aaa' },
      { type: 'dashboard_by_uid', value: 'bbb' },
    ],
  },
  metadata: {
    name: 'xyz',
  },
  status: {},
};

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
  const win: typeof globalThis = window;
  const oldLocation = win.location;
  const hrefMock = jest.fn();

  // JSDom defines window in a way that you cannot tamper with location so this seems to be the only way to change it.
  // https://github.com/facebook/jest/issues/5124#issuecomment-446659510
  //@ts-ignore
  delete win.location;

  win.location = {} as Location;

  // Only mocking href as that is all this test needs, but otherwise there is lots of things missing, so keep that
  // in mind if this is reused.
  Object.defineProperty(window.location, 'href', {
    set: hrefMock,
    get: hrefMock,
  });
  const unmock = () => {
    win.location = oldLocation;
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
    await srv.start(mockPlaylist);

    for (let i = 0; i < 6; i++) {
      srv.next();
    }

    expect(hrefMock).toHaveBeenCalledTimes(2);
    expect(hrefMock).toHaveBeenLastCalledWith(initialUrl);
  });

  it('keeps the refresh counter value after restarting', async () => {
    await srv.start(mockPlaylist);

    // 1 complete loop
    for (let i = 0; i < 3; i++) {
      srv.next();
    }

    srv.stop();
    await srv.start(mockPlaylist);

    // Another 2 loops
    for (let i = 0; i < 4; i++) {
      srv.next();
    }

    expect(hrefMock).toHaveBeenCalledTimes(3);
    expect(hrefMock).toHaveBeenLastCalledWith(initialUrl);
  });

  it('Should stop playlist when navigating away', async () => {
    await srv.start(mockPlaylist);

    locationService.push('/datasources');

    expect(srv.state.isPlaying).toBe(false);
  });

  it('storeUpdated should not stop playlist when navigating to next dashboard', async () => {
    await srv.start(mockPlaylist);

    // eslint-disable-next-line
    expect((srv as any).validPlaylistUrl).toBe('/url/to/aaa');

    srv.next();

    // eslint-disable-next-line
    expect((srv as any).validPlaylistUrl).toBe('/url/to/bbb');
    expect(srv.state.isPlaying).toBe(true);
  });

  it('uses each item own interval and falls back to the global interval', async () => {
    const getValidUrl = () => (srv as any).validPlaylistUrl; // eslint-disable-line @typescript-eslint/no-explicit-any

    const playlist: Playlist = {
      ...mockPlaylist,
      spec: {
        interval: '1s',
        title: 'The display',
        items: [
          { type: 'dashboard_by_uid', value: 'aaa', interval: '10s' },
          { type: 'dashboard_by_uid', value: 'bbb' }, // no interval -> global fallback (1s)
        ],
      },
    };

    jest.useFakeTimers();
    try {
      await srv.start(playlist);
      expect(getValidUrl()).toBe('/url/to/aaa');

      // aaa has its own 10s interval, so 1s (the global) must not advance it.
      jest.advanceTimersByTime(1000);
      expect(getValidUrl()).toBe('/url/to/aaa');

      // After a total of 10s it advances to bbb.
      jest.advanceTimersByTime(9000);
      expect(getValidUrl()).toBe('/url/to/bbb');

      // bbb has no interval, so it falls back to the global 1s and loops back to aaa.
      jest.advanceTimersByTime(1000);
      expect(getValidUrl()).toBe('/url/to/aaa');
    } finally {
      srv.stop();
      jest.useRealTimers();
    }
  });

  it('does not crash on an invalid per-item interval and falls back to the global one', async () => {
    const getValidUrl = () => (srv as any).validPlaylistUrl; // eslint-disable-line @typescript-eslint/no-explicit-any

    const playlist: Playlist = {
      ...mockPlaylist,
      spec: {
        interval: '1s',
        title: 'The display',
        items: [
          { type: 'dashboard_by_uid', value: 'aaa', interval: 'not-an-interval' },
          { type: 'dashboard_by_uid', value: 'bbb' },
        ],
      },
    };

    jest.useFakeTimers();
    try {
      await srv.start(playlist);
      // start() must complete cleanly rather than throwing mid-way and leaving a half-playing state.
      expect(srv.state.isPlaying).toBe(true);
      expect(getValidUrl()).toBe('/url/to/aaa');

      // The invalid interval falls back to the global 1s.
      jest.advanceTimersByTime(1000);
      expect(getValidUrl()).toBe('/url/to/bbb');
    } finally {
      srv.stop();
      jest.useRealTimers();
    }
  });

  it('should replace playlist start page in history when starting playlist', async () => {
    // Start at playlists page
    locationService.push('/playlists');

    // Navigate to playlist start page
    locationService.push('/playlists/play/foo');

    // Start the playlist
    await srv.start(mockPlaylist);

    // Get history entries via the underlying MemoryHistory (test-env only)
    const history = locationService.getHistory();
    const entries = (history as unknown as { base: { entries: Location[] } }).base.entries;

    // The current entry should be the first dashboard
    expect(entries[entries.length - 1].pathname).toBe('/url/to/aaa');

    // The previous entry should be the playlists page, not the start page
    expect(entries[entries.length - 2].pathname).toBe('/playlists');

    // Verify the start page (/playlists/play/foo) is not in history
    const hasStartPage = entries.some((entry: { pathname: string }) => entry.pathname === '/playlists/play/foo');
    expect(hasStartPage).toBe(false);
  });
});
