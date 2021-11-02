import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PlaylistEditPage } from './PlaylistEditPage';
import { backendSrv } from 'app/core/services/backend_srv';
import userEvent from '@testing-library/user-event';
import { locationService } from '@grafana/runtime';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
function getTestContext(_a) {
    var _b = _a === void 0 ? {} : _a, name = _b.name, interval = _b.interval, items = _b.items;
    return __awaiter(this, void 0, void 0, function () {
        var playlist, queryParams, route, match, location, history, navModel, getMock, putMock, rerender;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    jest.clearAllMocks();
                    playlist = { name: name, items: items, interval: interval };
                    queryParams = {};
                    route = {};
                    match = { params: { id: 1 } };
                    location = {};
                    history = {};
                    navModel = {
                        node: {},
                        main: {},
                    };
                    getMock = jest.spyOn(backendSrv, 'get');
                    putMock = jest.spyOn(backendSrv, 'put');
                    getMock.mockResolvedValue({
                        name: 'Test Playlist',
                        interval: '5s',
                        items: [{ title: 'First item', type: 'dashboard_by_id', order: 1, value: '1' }],
                    });
                    rerender = render(React.createElement(PlaylistEditPage, { queryParams: queryParams, route: route, match: match, location: location, history: history, navModel: navModel })).rerender;
                    return [4 /*yield*/, waitFor(function () { return expect(getMock).toHaveBeenCalledTimes(1); })];
                case 1:
                    _c.sent();
                    return [2 /*return*/, { playlist: playlist, rerender: rerender, putMock: putMock }];
            }
        });
    });
}
describe('PlaylistEditPage', function () {
    describe('when mounted', function () {
        it('then it should load playlist and header should be correct', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getTestContext()];
                    case 1:
                        _a.sent();
                        expect(screen.getByRole('heading', { name: /edit playlist/i })).toBeInTheDocument();
                        expect(screen.getByRole('textbox', { name: /playlist name/i })).toHaveValue('Test Playlist');
                        expect(screen.getByRole('textbox', { name: /playlist interval/i })).toHaveValue('5s');
                        expect(screen.getAllByRole('row', { name: /playlist item row/i })).toHaveLength(1);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when submitted', function () {
        it('then correct api should be called', function () { return __awaiter(void 0, void 0, void 0, function () {
            var putMock;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getTestContext()];
                    case 1:
                        putMock = (_a.sent()).putMock;
                        expect(locationService.getLocation().pathname).toEqual('/');
                        userEvent.clear(screen.getByRole('textbox', { name: /playlist name/i }));
                        userEvent.type(screen.getByRole('textbox', { name: /playlist name/i }), 'A Name');
                        userEvent.clear(screen.getByRole('textbox', { name: /playlist interval/i }));
                        userEvent.type(screen.getByRole('textbox', { name: /playlist interval/i }), '10s');
                        fireEvent.submit(screen.getByRole('button', { name: /save/i }));
                        return [4 /*yield*/, waitFor(function () { return expect(putMock).toHaveBeenCalledTimes(1); })];
                    case 2:
                        _a.sent();
                        expect(putMock).toHaveBeenCalledWith('/api/playlists/1', {
                            name: 'A Name',
                            interval: '10s',
                            items: [{ title: 'First item', type: 'dashboard_by_id', order: 1, value: '1' }],
                        });
                        expect(locationService.getLocation().pathname).toEqual('/playlists');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=PlaylistEditPage.test.js.map