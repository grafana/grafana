import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { PlaylistPage } from './PlaylistPage';
import { locationService } from '../../../../packages/grafana-runtime/src';
var fnMock = jest.fn();
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return ({
        get: fnMock,
    }); } })); });
jest.mock('app/core/services/context_srv', function () { return ({
    contextSrv: {
        isEditor: true,
    },
}); });
function getTestContext(propOverrides) {
    var props = {
        navModel: {
            main: {
                text: 'Playlist',
            },
            node: {
                text: 'playlist',
            },
        },
        route: {
            path: '/playlists',
            component: jest.fn(),
        },
        queryParams: { state: 'ok' },
        match: { params: { name: 'playlist', sourceName: 'test playlist' }, isExact: false, url: 'asdf', path: '' },
        history: locationService.getHistory(),
        location: { pathname: '', hash: '', search: '', state: '' },
    };
    Object.assign(props, propOverrides);
    return render(React.createElement(PlaylistPage, __assign({}, props)));
}
describe('PlaylistPage', function () {
    describe('when mounted without a playlist', function () {
        it('page should load', function () {
            fnMock.mockResolvedValue([]);
            var getByText = getTestContext().getByText;
            expect(getByText(/loading/i)).toBeInTheDocument();
        });
        it('then show empty list', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        getByText = getTestContext().getByText;
                        return [4 /*yield*/, waitFor(function () { return getByText('There are no playlists created yet'); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when mounted with a playlist', function () {
        it('page should load', function () {
            fnMock.mockResolvedValue([
                {
                    id: 0,
                    name: 'A test playlist',
                    interval: '10m',
                    items: [
                        { title: 'First item', type: 'dashboard_by_id', order: 1, value: '1' },
                        { title: 'Middle item', type: 'dashboard_by_id', order: 2, value: '2' },
                        { title: 'Last item', type: 'dashboard_by_tag', order: 2, value: 'Last item' },
                    ],
                },
            ]);
            var getByText = getTestContext().getByText;
            expect(getByText(/loading/i)).toBeInTheDocument();
        });
        it('then playlist title and buttons should appear on the page', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, getByRole, getByText;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext(), getByRole = _a.getByRole, getByText = _a.getByText;
                        return [4 /*yield*/, waitFor(function () { return getByText('A test playlist'); })];
                    case 1:
                        _b.sent();
                        expect(getByRole('button', { name: /Start playlist/i })).toBeInTheDocument();
                        expect(getByRole('link', { name: /Edit playlist/i })).toBeInTheDocument();
                        expect(getByRole('button', { name: /Delete playlist/i })).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=PlaylistPage.test.js.map