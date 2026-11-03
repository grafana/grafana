import { type Store } from 'redux';
import configureMockStore from 'redux-mock-store';

import { locationService, registerPlaylistItemKind } from '@grafana/runtime';
import { resetPlaylistItemKindsForTests } from '@grafana/runtime/internal';
import { setStore } from 'app/store/store';

import { type Playlist } from '../../api/clients/playlist/v1';
import { type DashboardQueryResult } from '../search/service/types';

import { PlaylistSrv } from './PlaylistSrv';
import { type PlaylistItemUI } from './types';

jest.mock('./utils', () => ({
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

describe('PlaylistSrv with slideshows', () => {
  const kindThings = (resolve: (name: string) => Promise<{ url: string; title: string } | undefined>) => {
    registerPlaylistItemKind({
      group: 'things.example.app',
      resource: 'things',
      title: 'Things',
      icon: 'file-alt',
      resolve,
      search: async () => [],
    });
  };
  type TestItem = { group: string; resource: string; name: string; interval?: string };
  const item = (name: string, interval?: string): TestItem => ({
    group: 'things.example.app',
    resource: 'things',
    name,
    interval,
  });
  const slideshow = (items: TestItem[], interval = '5m') => ({
    spec: { title: 'Wall', interval, items },
  });

  let srv: PlaylistSrv;
  let hrefMock: jest.Mock;
  let unmockLocation: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    resetPlaylistItemKindsForTests();
    srv = createPlaylistSrv();
    [hrefMock, unmockLocation] = mockWindowLocation();
    hrefMock.mockReturnValue('http://localhost/slideshows/play/wall');
  });

  afterEach(() => {
    srv.stop();
    unmockLocation();
    jest.useRealTimers();
  });

  const pathname = () => locationService.getLocation().pathname;

  it('plays a mixed list in order and loops', async () => {
    kindThings(async (name) => ({ url: `/things/${name}`, title: name }));
    registerPlaylistItemKind({
      group: 'other.example.app',
      resource: 'others',
      title: 'Others',
      icon: 'file-alt',
      resolve: async (name) => ({ url: `/others/${name}`, title: name }),
      search: async () => [],
    });

    await srv.startSlideshow(
      slideshow([item('a'), { group: 'other.example.app', resource: 'others', name: 'b' }, item('c')])
    );

    const seen = [pathname()];
    srv.next();
    seen.push(pathname());
    srv.next();
    seen.push(pathname());
    srv.next();
    seen.push(pathname());

    expect(seen).toEqual(['/things/a', '/others/b', '/things/c', '/things/a']);
  });

  it('skips items that are missing, forbidden, unknown or whose resolver fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation();
    kindThings(async (name) => {
      if (name === 'gone') {
        return undefined;
      }
      if (name === 'broken') {
        throw new Error('boom');
      }
      return { url: `/things/${name}`, title: name };
    });

    await srv.startSlideshow(
      slideshow([
        item('a'),
        item('gone'),
        item('broken'),
        { group: 'removed.example.app', resource: 'stuff', name: 'x' },
        item('b'),
      ])
    );

    const seen = [pathname()];
    srv.next();
    seen.push(pathname());
    srv.next();
    seen.push(pathname());

    expect(seen).toEqual(['/things/a', '/things/b', '/things/a']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('things.example.app/things'), expect.any(Error));
    warn.mockRestore();
  });

  it('does not start a slideshow stored without items', async () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const stored = { spec: { interval: '5m', items: null } } as unknown as Parameters<PlaylistSrv['startSlideshow']>[0];

    await srv.startSlideshow(stored);

    expect(pathname()).toBe('/playlists/foo');
    expect(srv.state.isPlaying).toBe(false);
  });

  it('does not start when every item is skipped', async () => {
    kindThings(async () => undefined);

    await srv.startSlideshow(slideshow([item('gone')]));

    expect(pathname()).toBe('/playlists/foo');
  });

  it('uses an item interval instead of the slideshow interval', async () => {
    jest.useFakeTimers();
    kindThings(async (name) => ({ url: `/things/${name}`, title: name }));

    await srv.startSlideshow(slideshow([item('a', '30s'), item('b')], '5m'));
    expect(pathname()).toBe('/things/a');

    jest.advanceTimersByTime(29_000);
    expect(pathname()).toBe('/things/a');
    jest.advanceTimersByTime(1_000);
    expect(pathname()).toBe('/things/b');

    // b has no interval of its own, so the slideshow's five minutes apply.
    jest.advanceTimersByTime(4 * 60_000);
    expect(pathname()).toBe('/things/b');
    jest.advanceTimersByTime(60_000);
    expect(pathname()).toBe('/things/a');
  });

  it('honors the interval of a dashboard playlist item', async () => {
    jest.useFakeTimers();
    const playlist: Playlist = {
      ...mockPlaylist,
      spec: {
        ...mockPlaylist.spec,
        interval: '5m',
        items: [
          { type: 'dashboard_by_uid', value: 'aaa', interval: '30s' },
          { type: 'dashboard_by_uid', value: 'bbb' },
        ],
      },
    };

    await srv.start(playlist);
    jest.advanceTimersByTime(30_000);

    expect(pathname()).toBe('/url/to/bbb');
  });

  it('keeps playing when a page redirects with a history replace', async () => {
    kindThings(async (name) => ({ url: `/things/${name}`, title: name }));
    await srv.startSlideshow(slideshow([item('a'), item('b')]));

    locationService.getHistory().replace('/things/a/with-slug');

    expect(srv.state.isPlaying).toBe(true);
    srv.next();
    expect(pathname()).toBe('/things/b');
    expect(srv.state.isPlaying).toBe(true);
  });

  it('stops when a redirect is a push', async () => {
    kindThings(async (name) => ({ url: `/things/${name}`, title: name }));
    await srv.startSlideshow(slideshow([item('a'), item('b')]));

    locationService.push('/things/a/with-slug');

    expect(srv.state.isPlaying).toBe(false);
  });

  it('stops when the user navigates after the page has redirected', async () => {
    kindThings(async (name) => ({ url: `/things/${name}`, title: name }));
    await srv.startSlideshow(slideshow([item('a'), item('b')]));

    locationService.getHistory().replace('/things/a/with-slug');
    locationService.push('/datasources');

    expect(srv.state.isPlaying).toBe(false);
  });

  it('keeps kiosk and display options on every item even when a page drops them', async () => {
    kindThings(async (name) => ({ url: `/things/${name}`, title: name }));
    locationService.push('/slideshows/play/wall?kiosk=true&_dash.hideTimePicker=true&ignored=1');

    await srv.startSlideshow(slideshow([item('a'), item('b')]));
    expect(locationService.getSearchObject()).toMatchObject({ kiosk: true, '_dash.hideTimePicker': true });
    expect(locationService.getSearchObject()).not.toHaveProperty('ignored');

    // The page rewrites its own url and loses the query string.
    locationService.getHistory().replace('/things/a/with-slug');
    srv.next();

    expect(pathname()).toBe('/things/b');
    expect(locationService.getSearchObject()).toMatchObject({ kiosk: true, '_dash.hideTimePicker': true });
  });
});
