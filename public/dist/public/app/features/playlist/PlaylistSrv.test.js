import { __awaiter } from "tslib";
import configureMockStore from 'redux-mock-store';
import { locationService } from '@grafana/runtime';
import { setStore } from 'app/store/store';
import { PlaylistSrv } from './PlaylistSrv';
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
        }),
    }),
    loadDashboards: (items) => {
        return Promise.resolve(items.map((v) => (Object.assign(Object.assign({}, v), { dashboards: [{ url: `/url/to/${v.value}` }] }))));
    },
}));
const mockStore = configureMockStore();
setStore(mockStore({
    location: {},
}));
function createPlaylistSrv() {
    locationService.push('/playlists/foo');
    return new PlaylistSrv();
}
const mockWindowLocation = () => {
    const oldLocation = window.location;
    const hrefMock = jest.fn();
    // JSDom defines window in a way that you cannot tamper with location so this seems to be the only way to change it.
    // https://github.com/facebook/jest/issues/5124#issuecomment-446659510
    //@ts-ignore
    delete window.location;
    window.location = {};
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
    let srv;
    let hrefMock;
    let unmockLocation;
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
    it('runs all dashboards in cycle and reloads page after 3 cycles', () => __awaiter(void 0, void 0, void 0, function* () {
        yield srv.start('foo');
        for (let i = 0; i < 6; i++) {
            srv.next();
        }
        expect(hrefMock).toHaveBeenCalledTimes(2);
        expect(hrefMock).toHaveBeenLastCalledWith(initialUrl);
    }));
    it('keeps the refresh counter value after restarting', () => __awaiter(void 0, void 0, void 0, function* () {
        yield srv.start('foo');
        // 1 complete loop
        for (let i = 0; i < 3; i++) {
            srv.next();
        }
        srv.stop();
        yield srv.start('foo');
        // Another 2 loops
        for (let i = 0; i < 4; i++) {
            srv.next();
        }
        expect(hrefMock).toHaveBeenCalledTimes(3);
        expect(hrefMock).toHaveBeenLastCalledWith(initialUrl);
    }));
    it('Should stop playlist when navigating away', () => __awaiter(void 0, void 0, void 0, function* () {
        yield srv.start('foo');
        locationService.push('/datasources');
        expect(srv.isPlaying).toBe(false);
    }));
    it('storeUpdated should not stop playlist when navigating to next dashboard', () => __awaiter(void 0, void 0, void 0, function* () {
        yield srv.start('foo');
        // eslint-disable-next-line
        expect(srv.validPlaylistUrl).toBe('/url/to/aaa');
        srv.next();
        // eslint-disable-next-line
        expect(srv.validPlaylistUrl).toBe('/url/to/bbb');
        expect(srv.isPlaying).toBe(true);
    }));
});
//# sourceMappingURL=PlaylistSrv.test.js.map