// @ts-ignore
import configureMockStore from 'redux-mock-store';
import { PlaylistSrv } from '../playlist_srv';
import { setStore } from 'app/store/store';

const getMock = jest.fn();

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    getBackendSrv: () => ({
      get: getMock,
    }),
  };
});

const mockStore = configureMockStore<any, any>();

setStore(
  mockStore({
    location: {},
  }) as any
);

const dashboards = [{ url: 'dash1' }, { url: 'dash2' }];

const createPlaylistSrv = (): [PlaylistSrv, { url: jest.MockInstance<any, any> }] => {
  const mockLocation = {
    url: jest.fn(),
    search: () => ({}),
    path: () => '/playlists/1',
  };

  const mockTimeout = jest.fn();
  (mockTimeout as any).cancel = jest.fn();

  return [new PlaylistSrv(mockLocation, mockTimeout), mockLocation];
};

const mockWindowLocation = (): [jest.MockInstance<any, any>, () => void] => {
  const oldLocation = window.location;
  const hrefMock = jest.fn();

  // JSDom defines window in a way that you cannot tamper with location so this seems to be the only way to change it.
  // https://github.com/facebook/jest/issues/5124#issuecomment-446659510
  //@ts-ignore
  delete window.location;
  window.location = {} as any;

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
  let hrefMock: jest.MockInstance<any, any>;
  let unmockLocation: () => void;
  const initialUrl = 'http://localhost/playlist';

  beforeEach(() => {
    jest.clearAllMocks();
    getMock.mockImplementation(
      jest.fn(url => {
        switch (url) {
          case '/api/playlists/1':
            return Promise.resolve({ interval: '1s' });
          case '/api/playlists/1/dashboards':
            return Promise.resolve(dashboards);
          default:
            throw new Error(`Unexpected url=${url}`);
        }
      })
    );

    [srv] = createPlaylistSrv();
    [hrefMock, unmockLocation] = mockWindowLocation();

    // This will be cached in the srv when start() is called
    hrefMock.mockReturnValue(initialUrl);
  });

  afterEach(() => {
    unmockLocation();
  });

  it('runs all dashboards in cycle and reloads page after 3 cycles', async () => {
    await srv.start(1);

    for (let i = 0; i < 6; i++) {
      srv.next();
    }

    expect(hrefMock).toHaveBeenCalledTimes(2);
    expect(hrefMock).toHaveBeenLastCalledWith(initialUrl);
  });

  it('keeps the refresh counter value after restarting', async () => {
    await srv.start(1);

    // 1 complete loop
    for (let i = 0; i < 3; i++) {
      srv.next();
    }

    srv.stop();
    await srv.start(1);

    // Another 2 loops
    for (let i = 0; i < 4; i++) {
      srv.next();
    }

    expect(hrefMock).toHaveBeenCalledTimes(3);
    expect(hrefMock).toHaveBeenLastCalledWith(initialUrl);
  });

  it('storeUpdated should stop playlist when navigating away', async () => {
    await srv.start(1);

    srv.storeUpdated();

    expect(srv.isPlaying).toBe(false);
  });

  it('storeUpdated should not stop playlist when navigating to next dashboard', async () => {
    await srv.start(1);

    srv.next();

    setStore(
      mockStore({
        location: {
          path: 'dash2',
        },
      }) as any
    );

    expect((srv as any).validPlaylistUrl).toBe('dash2');

    srv.storeUpdated();

    expect(srv.isPlaying).toBe(true);
  });
});
