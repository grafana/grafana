var _this = this;
import * as tslib_1 from "tslib";
import configureMockStore from 'redux-mock-store';
import { PlaylistSrv } from '../playlist_srv';
import { setStore } from 'app/store/store';
var mockStore = configureMockStore();
setStore(mockStore({
    location: {},
}));
var dashboards = [{ url: 'dash1' }, { url: 'dash2' }];
var createPlaylistSrv = function () {
    var mockBackendSrv = {
        get: jest.fn(function (url) {
            switch (url) {
                case '/api/playlists/1':
                    return Promise.resolve({ interval: '1s' });
                case '/api/playlists/1/dashboards':
                    return Promise.resolve(dashboards);
                default:
                    throw new Error("Unexpected url=" + url);
            }
        }),
    };
    var mockLocation = {
        url: jest.fn(),
        search: function () { return ({}); },
        path: function () { return '/playlists/1'; },
    };
    var mockTimeout = jest.fn();
    mockTimeout.cancel = jest.fn();
    return [new PlaylistSrv(mockLocation, mockTimeout, mockBackendSrv), mockLocation];
};
var mockWindowLocation = function () {
    var oldLocation = window.location;
    var hrefMock = jest.fn();
    // JSDom defines window in a way that you cannot tamper with location so this seems to be the only way to change it.
    // https://github.com/facebook/jest/issues/5124#issuecomment-446659510
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
        var _a, _b;
        _a = tslib_1.__read(createPlaylistSrv(), 1), srv = _a[0];
        _b = tslib_1.__read(mockWindowLocation(), 2), hrefMock = _b[0], unmockLocation = _b[1];
        // This will be cached in the srv when start() is called
        hrefMock.mockReturnValue(initialUrl);
    });
    afterEach(function () {
        unmockLocation();
    });
    it('runs all dashboards in cycle and reloads page after 3 cycles', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var i;
        return tslib_1.__generator(this, function (_a) {
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
    it('keeps the refresh counter value after restarting', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var i, i;
        return tslib_1.__generator(this, function (_a) {
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
    it('storeUpdated should stop playlist when navigating away', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, srv.start(1)];
                case 1:
                    _a.sent();
                    srv.storeUpdated();
                    expect(srv.isPlaying).toBe(false);
                    return [2 /*return*/];
            }
        });
    }); });
    it('storeUpdated should not stop playlist when navigating to next dashboard', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, srv.start(1)];
                case 1:
                    _a.sent();
                    srv.next();
                    setStore(mockStore({
                        location: {
                            path: 'dash2',
                        },
                    }));
                    expect(srv.validPlaylistUrl).toBe('dash2');
                    srv.storeUpdated();
                    expect(srv.isPlaying).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=playlist_srv.test.js.map