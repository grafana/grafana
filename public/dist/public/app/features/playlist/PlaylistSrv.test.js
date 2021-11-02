import { __assign, __awaiter, __generator, __read } from "tslib";
// @ts-ignore
import configureMockStore from 'redux-mock-store';
import { PlaylistSrv } from './PlaylistSrv';
import { setStore } from 'app/store/store';
import { locationService } from '@grafana/runtime';
var getMock = jest.fn();
jest.mock('@grafana/runtime', function () {
    var original = jest.requireActual('@grafana/runtime');
    return __assign(__assign({}, original), { getBackendSrv: function () { return ({
            get: getMock,
        }); } });
});
var mockStore = configureMockStore();
setStore(mockStore({
    location: {},
}));
var dashboards = [{ url: '/dash1' }, { url: '/dash2' }];
function createPlaylistSrv() {
    locationService.push('/playlists/1');
    return new PlaylistSrv();
}
var mockWindowLocation = function () {
    var oldLocation = window.location;
    var hrefMock = jest.fn();
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
    var unmock = function () {
        window.location = oldLocation;
    };
    return [hrefMock, unmock];
};
describe('PlaylistSrv', function () {
    var srv;
    var hrefMock;
    var unmockLocation;
    var initialUrl = 'http://localhost/playlist';
    beforeEach(function () {
        var _a;
        jest.clearAllMocks();
        getMock.mockImplementation(jest.fn(function (url) {
            switch (url) {
                case '/api/playlists/1':
                    return Promise.resolve({ interval: '1s' });
                case '/api/playlists/1/dashboards':
                    return Promise.resolve(dashboards);
                default:
                    throw new Error("Unexpected url=" + url);
            }
        }));
        srv = createPlaylistSrv();
        _a = __read(mockWindowLocation(), 2), hrefMock = _a[0], unmockLocation = _a[1];
        // This will be cached in the srv when start() is called
        hrefMock.mockReturnValue(initialUrl);
    });
    afterEach(function () {
        unmockLocation();
    });
    it('runs all dashboards in cycle and reloads page after 3 cycles', function () { return __awaiter(void 0, void 0, void 0, function () {
        var i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, srv.start(1)];
                case 1:
                    _a.sent();
                    for (i = 0; i < 6; i++) {
                        srv.next();
                    }
                    expect(hrefMock).toHaveBeenCalledTimes(2);
                    expect(hrefMock).toHaveBeenLastCalledWith(initialUrl);
                    return [2 /*return*/];
            }
        });
    }); });
    it('keeps the refresh counter value after restarting', function () { return __awaiter(void 0, void 0, void 0, function () {
        var i, i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, srv.start(1)];
                case 1:
                    _a.sent();
                    // 1 complete loop
                    for (i = 0; i < 3; i++) {
                        srv.next();
                    }
                    srv.stop();
                    return [4 /*yield*/, srv.start(1)];
                case 2:
                    _a.sent();
                    // Another 2 loops
                    for (i = 0; i < 4; i++) {
                        srv.next();
                    }
                    expect(hrefMock).toHaveBeenCalledTimes(3);
                    expect(hrefMock).toHaveBeenLastCalledWith(initialUrl);
                    return [2 /*return*/];
            }
        });
    }); });
    it('Should stop playlist when navigating away', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, srv.start(1)];
                case 1:
                    _a.sent();
                    locationService.push('/datasources');
                    expect(srv.isPlaying).toBe(false);
                    return [2 /*return*/];
            }
        });
    }); });
    it('storeUpdated should not stop playlist when navigating to next dashboard', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, srv.start(1)];
                case 1:
                    _a.sent();
                    srv.next();
                    expect(srv.validPlaylistUrl).toBe('/dash2');
                    expect(srv.isPlaying).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=PlaylistSrv.test.js.map