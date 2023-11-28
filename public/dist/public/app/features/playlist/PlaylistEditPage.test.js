import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { locationService } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { PlaylistEditPage } from './PlaylistEditPage';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv })));
jest.mock('app/core/components/TagFilter/TagFilter', () => ({
    TagFilter: () => {
        return React.createElement(React.Fragment, null, "mocked-tag-filter");
    },
}));
function getTestContext({ name, interval, items, uid } = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        jest.clearAllMocks();
        const playlist = { name, items, interval, uid };
        const queryParams = {};
        const route = {};
        const match = { params: { uid: 'foo' } };
        const location = {};
        const history = {};
        const getMock = jest.spyOn(backendSrv, 'get');
        const putMock = jest.spyOn(backendSrv, 'put');
        getMock.mockResolvedValue({
            name: 'Test Playlist',
            interval: '5s',
            items: [{ title: 'First item', type: 'dashboard_by_uid', order: 1, value: '1' }],
            uid: 'foo',
        });
        const { rerender } = render(React.createElement(TestProvider, null,
            React.createElement(PlaylistEditPage, { queryParams: queryParams, route: route, match: match, location: location, history: history })));
        yield waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));
        return { playlist, rerender, putMock };
    });
}
describe('PlaylistEditPage', () => {
    describe('when mounted', () => {
        it('then it should load playlist and header should be correct', () => __awaiter(void 0, void 0, void 0, function* () {
            yield getTestContext();
            expect(yield screen.findByRole('heading', { name: /edit playlist/i })).toBeInTheDocument();
            expect(screen.getByRole('textbox', { name: /playlist name/i })).toHaveValue('Test Playlist');
            expect(screen.getByRole('textbox', { name: /playlist interval/i })).toHaveValue('5s');
            expect(screen.getAllByRole('row')).toHaveLength(1);
        }));
    });
    describe('when submitted', () => {
        it('then correct api should be called', () => __awaiter(void 0, void 0, void 0, function* () {
            const { putMock } = yield getTestContext();
            expect(yield screen.findByRole('heading', { name: /edit playlist/i })).toBeInTheDocument();
            expect(locationService.getLocation().pathname).toEqual('/');
            yield userEvent.clear(screen.getByRole('textbox', { name: /playlist name/i }));
            yield userEvent.type(screen.getByRole('textbox', { name: /playlist name/i }), 'A Name');
            yield userEvent.clear(screen.getByRole('textbox', { name: /playlist interval/i }));
            yield userEvent.type(screen.getByRole('textbox', { name: /playlist interval/i }), '10s');
            fireEvent.submit(screen.getByRole('button', { name: /save/i }));
            yield waitFor(() => expect(putMock).toHaveBeenCalledTimes(1));
            expect(putMock).toHaveBeenCalledWith('/api/playlists/foo', {
                uid: 'foo',
                name: 'A Name',
                interval: '10s',
                items: [{ title: 'First item', type: 'dashboard_by_uid', order: 1, value: '1' }],
            });
            expect(locationService.getLocation().pathname).toEqual('/playlists');
        }));
    });
});
//# sourceMappingURL=PlaylistEditPage.test.js.map