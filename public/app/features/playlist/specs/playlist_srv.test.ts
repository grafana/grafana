import { PlaylistSrv } from '../playlist_srv';

const dashboards = [{ uri: 'dash1' }, { uri: 'dash2' }];

const createPlaylistSrv = (): [PlaylistSrv, { url: jest.MockInstance<any> }] => {
  const mockBackendSrv = {
    get: jest.fn(url => {
      switch (url) {
        case '/api/playlists/1':
          return Promise.resolve({ interval: '1s' });
        case '/api/playlists/1/dashboards':
          return Promise.resolve(dashboards);
        default:
          throw new Error(`Unexpected url=${url}`);
      }
    }),
  };

  const mockLocation = {
    url: jest.fn(),
    search: () => ({}),
  };

  const mockTimeout = jest.fn();
  (mockTimeout as any).cancel = jest.fn();

  return [new PlaylistSrv(mockLocation, mockTimeout, mockBackendSrv), mockLocation];
};

const mockWindowLocation = (): [jest.MockInstance<any>, () => void] => {
  const oldLocation = window.location;
  const hrefMock = jest.fn();

  // JSDom defines window in a way that you cannot tamper with location so this seems to be the only way to change it.
  // https://github.com/facebook/jest/issues/5124#issuecomment-446659510
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
  let mockLocationService: { url: jest.MockInstance<any> };
  let hrefMock: jest.MockInstance<any>;
  let unmockLocation: () => void;
  const initialUrl = 'http://localhost/playlist';

  beforeEach(() => {
    [srv, mockLocationService] = createPlaylistSrv();
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
      expect(mockLocationService.url).toHaveBeenLastCalledWith(`dashboard/${dashboards[i % 2].uri}?`);
      srv.next();
    }

    expect(hrefMock).toHaveBeenCalledTimes(2);
    expect(hrefMock).toHaveBeenLastCalledWith(initialUrl);
  });

  it('keeps the refresh counter value after restarting', async () => {
    await srv.start(1);

    // 1 complete loop
    for (let i = 0; i < 3; i++) {
      expect(mockLocationService.url).toHaveBeenLastCalledWith(`dashboard/${dashboards[i % 2].uri}?`);
      srv.next();
    }

    srv.stop();
    await srv.start(1);

    // Another 2 loops
    for (let i = 0; i < 4; i++) {
      expect(mockLocationService.url).toHaveBeenLastCalledWith(`dashboard/${dashboards[i % 2].uri}?`);
      srv.next();
    }

    expect(hrefMock).toHaveBeenCalledTimes(3);
    expect(hrefMock).toHaveBeenLastCalledWith(initialUrl);
  });
});
