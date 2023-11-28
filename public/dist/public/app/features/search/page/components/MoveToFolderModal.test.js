import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { selectors } from '@grafana/e2e-selectors';
import config from 'app/core/config';
import * as api from 'app/features/manage-dashboards/state/actions';
import { DashboardSearchItemType } from '../../types';
import { MoveToFolderModal } from './MoveToFolderModal';
function makeSelections(dashboardUIDs = [], folderUIDs = []) {
    const dashboards = new Set(dashboardUIDs);
    const folders = new Set(folderUIDs);
    return new Map([
        ['dashboard', dashboards],
        ['folder', folders],
    ]);
}
function makeDashboardSearchHit(title, uid, type = DashboardSearchItemType.DashDB) {
    return { title, uid, tags: [], type, url: `/d/${uid}` };
}
describe('MoveToFolderModal', () => {
    jest
        .spyOn(api, 'searchFolders')
        .mockResolvedValue([
        makeDashboardSearchHit('General', '', DashboardSearchItemType.DashFolder),
        makeDashboardSearchHit('Folder 1', 'folder-uid-1', DashboardSearchItemType.DashFolder),
        makeDashboardSearchHit('Folder 2', 'folder-uid-1', DashboardSearchItemType.DashFolder),
        makeDashboardSearchHit('Folder 3', 'folder-uid-3', DashboardSearchItemType.DashFolder),
    ]);
    it('should render correct title, body, dismiss-, cancel- and move-text', () => __awaiter(void 0, void 0, void 0, function* () {
        const items = makeSelections(['dash-uid-1', 'dash-uid-2']);
        const mockStore = configureMockStore();
        const store = mockStore({ dashboard: { panels: [] } });
        const onMoveItems = jest.fn();
        render(React.createElement(Provider, { store: store },
            React.createElement(MoveToFolderModal, { onMoveItems: onMoveItems, results: items, onDismiss: () => { } })));
        // Wait for folder picker to finish rendering
        yield screen.findByText('Choose');
        expect(screen.getByRole('heading', { name: 'Choose Dashboard Folder' })).toBeInTheDocument();
        expect(screen.getByText('Move 2 dashboards to:')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
    }));
    it('should move dashboards, but not folders', () => __awaiter(void 0, void 0, void 0, function* () {
        const moveDashboardsMock = jest.spyOn(api, 'moveDashboards').mockResolvedValue({
            successCount: 2,
            totalCount: 2,
            alreadyInFolderCount: 0,
        });
        const moveFoldersMock = jest.spyOn(api, 'moveFolders').mockResolvedValue({
            successCount: 1,
            totalCount: 1,
        });
        const items = makeSelections(['dash-uid-1', 'dash-uid-2'], ['folder-uid-1']);
        const mockStore = configureMockStore();
        const store = mockStore({ dashboard: { panels: [] } });
        const onMoveItems = jest.fn();
        render(React.createElement(Provider, { store: store },
            React.createElement(MoveToFolderModal, { onMoveItems: onMoveItems, results: items, onDismiss: () => { } })));
        // Wait for folder picker to finish rendering
        yield screen.findByText('Choose');
        const folderPicker = screen.getByLabelText(selectors.components.FolderPicker.input);
        yield selectOptionInTest(folderPicker, 'Folder 3');
        const moveButton = screen.getByText('Move');
        yield userEvent.click(moveButton);
        expect(moveDashboardsMock).toHaveBeenCalledWith(['dash-uid-1', 'dash-uid-2'], {
            title: 'Folder 3',
            uid: 'folder-uid-3',
        });
        expect(moveFoldersMock).not.toHaveBeenCalled();
    }));
    describe('with nestedFolders feature flag', () => {
        let originalNestedFoldersValue = config.featureToggles.nestedFolders;
        beforeAll(() => {
            originalNestedFoldersValue = config.featureToggles.nestedFolders;
            config.featureToggles.nestedFolders = true;
        });
        afterAll(() => {
            config.featureToggles.nestedFolders = originalNestedFoldersValue;
        });
        it('should move folders and dashboards', () => __awaiter(void 0, void 0, void 0, function* () {
            const moveDashboardsMock = jest.spyOn(api, 'moveDashboards').mockResolvedValue({
                successCount: 2,
                totalCount: 2,
                alreadyInFolderCount: 0,
            });
            const moveFoldersMock = jest.spyOn(api, 'moveFolders').mockResolvedValue({
                successCount: 1,
                totalCount: 1,
            });
            const items = makeSelections(['dash-uid-1', 'dash-uid-2'], ['folder-uid-1']);
            const mockStore = configureMockStore();
            const store = mockStore({ dashboard: { panels: [] } });
            const onMoveItems = jest.fn();
            render(React.createElement(Provider, { store: store },
                React.createElement(MoveToFolderModal, { onMoveItems: onMoveItems, results: items, onDismiss: () => { } })));
            // Wait for folder picker to finish rendering
            yield screen.findByText('Choose');
            const folderPicker = screen.getByLabelText(selectors.components.FolderPicker.input);
            yield selectOptionInTest(folderPicker, 'Folder 3');
            const moveButton = screen.getByRole('button', { name: 'Move' });
            yield userEvent.click(moveButton);
            expect(moveDashboardsMock).toHaveBeenCalledWith(['dash-uid-1', 'dash-uid-2'], {
                title: 'Folder 3',
                uid: 'folder-uid-3',
            });
            expect(moveFoldersMock).toHaveBeenCalledWith(['folder-uid-1'], {
                title: 'Folder 3',
                uid: 'folder-uid-3',
            });
        }));
    });
});
//# sourceMappingURL=MoveToFolderModal.test.js.map