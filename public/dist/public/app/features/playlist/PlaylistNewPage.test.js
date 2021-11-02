import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaylistNewPage } from './PlaylistNewPage';
import { backendSrv } from '../../core/services/backend_srv';
import { locationService } from '@grafana/runtime';
jest.mock('./usePlaylist', function () { return ({
    // so we don't need to add dashboard items in test
    usePlaylist: jest.fn().mockReturnValue({
        playlist: { items: [{ title: 'First item', type: 'dashboard_by_id', order: 1, value: '1' }], loading: false },
    }),
}); });
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
function getTestContext(_a) {
    var _b = _a === void 0 ? {} : _a, name = _b.name, interval = _b.interval, items = _b.items;
    jest.clearAllMocks();
    var playlist = { name: name, items: items, interval: interval };
    var queryParams = {};
    var route = {};
    var match = {};
    var location = {};
    var history = {};
    var navModel = {
        node: {},
        main: {},
    };
    var backendSrvMock = jest.spyOn(backendSrv, 'post');
    var rerender = render(React.createElement(PlaylistNewPage, { queryParams: queryParams, route: route, match: match, location: location, history: history, navModel: navModel })).rerender;
    return { playlist: playlist, rerender: rerender, backendSrvMock: backendSrvMock };
}
describe('PlaylistNewPage', function () {
    describe('when mounted', function () {
        it('then header should be correct', function () {
            getTestContext();
            expect(screen.getByRole('heading', { name: /new playlist/i })).toBeInTheDocument();
        });
    });
    describe('when submitted', function () {
        it('then correct api should be called', function () { return __awaiter(void 0, void 0, void 0, function () {
            var backendSrvMock;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        backendSrvMock = getTestContext().backendSrvMock;
                        expect(locationService.getLocation().pathname).toEqual('/');
                        userEvent.type(screen.getByRole('textbox', { name: /playlist name/i }), 'A Name');
                        fireEvent.submit(screen.getByRole('button', { name: /save/i }));
                        return [4 /*yield*/, waitFor(function () { return expect(backendSrvMock).toHaveBeenCalledTimes(1); })];
                    case 1:
                        _a.sent();
                        expect(backendSrvMock).toHaveBeenCalledWith('/api/playlists', {
                            name: 'A Name',
                            interval: '5m',
                            items: [{ title: 'First item', type: 'dashboard_by_id', order: 1, value: '1' }],
                        });
                        expect(locationService.getLocation().pathname).toEqual('/playlists');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=PlaylistNewPage.test.js.map