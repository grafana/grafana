import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { backendSrv } from '../../core/services/backend_srv';
import { PlaylistNewPage } from './PlaylistNewPage';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv })));
jest.mock('app/core/components/TagFilter/TagFilter', () => ({
    TagFilter: () => {
        return React.createElement(React.Fragment, null, "mocked-tag-filter");
    },
}));
function getTestContext({ name, interval, items } = {}) {
    jest.clearAllMocks();
    const playlist = { name, items, interval };
    const backendSrvMock = jest.spyOn(backendSrv, 'post');
    const { rerender } = render(React.createElement(TestProvider, null,
        React.createElement(PlaylistNewPage, null)));
    return { playlist, rerender, backendSrvMock };
}
describe('PlaylistNewPage', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });
    describe('when mounted', () => {
        it('then header should be correct', () => {
            getTestContext();
            expect(screen.getByRole('heading', { name: /new playlist/i })).toBeInTheDocument();
        });
    });
    describe('when submitted', () => {
        it('then correct api should be called', () => __awaiter(void 0, void 0, void 0, function* () {
            const { backendSrvMock } = getTestContext();
            expect(locationService.getLocation().pathname).toEqual('/');
            yield userEvent.type(screen.getByRole('textbox', { name: selectors.pages.PlaylistForm.name }), 'A new name');
            fireEvent.submit(screen.getByRole('button', { name: /save/i }));
            yield waitFor(() => expect(backendSrvMock).toHaveBeenCalledTimes(1));
            expect(backendSrvMock).toHaveBeenCalledWith('/api/playlists', {
                name: 'A new name',
                uid: '',
                interval: '5m',
                items: [],
            });
            expect(locationService.getLocation().pathname).toEqual('/playlists');
        }));
    });
});
//# sourceMappingURL=PlaylistNewPage.test.js.map