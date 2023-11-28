import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { contextSrv } from 'app/core/services/context_srv';
import { ManageActions } from './ManageActions';
jest.mock('app/core/services/context_srv', () => ({
    contextSrv: {
        hasEditPermissionInFolders: false,
    },
}));
jest.mock('app/core/components/Select/OldFolderPicker', () => {
    return {
        OldFolderPicker: () => null,
    };
});
describe('ManageActions', () => {
    describe('when user has edit permission in folders', () => {
        // Permissions
        contextSrv.hasEditPermissionInFolders = true;
        // Mock selected dashboards
        const mockItemsSelected = new Map();
        const mockDashboardsUIDsSelected = new Set();
        mockDashboardsUIDsSelected.add('uid1');
        mockDashboardsUIDsSelected.add('uid2');
        mockItemsSelected.set('dashboard', mockDashboardsUIDsSelected);
        //Mock store redux for old MoveDashboards state action
        const mockStore = configureMockStore();
        const store = mockStore({ dashboard: { panels: [] } });
        const onChange = jest.fn();
        const clearSelection = jest.fn();
        it('should show move when user click the move button', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(Provider, { store: store },
                React.createElement(ManageActions, { items: mockItemsSelected, onChange: onChange, clearSelection: clearSelection })));
            expect(screen.getByTestId('manage-actions')).toBeInTheDocument();
            expect(yield screen.findByRole('button', { name: 'Move', hidden: true })).not.toBeDisabled();
            expect(yield screen.findByRole('button', { name: 'Delete', hidden: true })).not.toBeDisabled();
            // open Move modal
            yield userEvent.click(screen.getByRole('button', { name: 'Move', hidden: true }));
            expect(screen.getByText(/Move 2 dashboards to:/i)).toBeInTheDocument();
        }));
        it('should show delete modal when user click the delete button', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(Provider, { store: store },
                React.createElement(ManageActions, { items: mockItemsSelected, onChange: onChange, clearSelection: clearSelection })));
            expect(screen.getByTestId('manage-actions')).toBeInTheDocument();
            // open Delete modal
            yield userEvent.click(screen.getByRole('button', { name: 'Delete', hidden: true }));
            expect(screen.getByText(/Do you want to delete the 2 selected dashboards\?/i)).toBeInTheDocument();
        }));
    });
    describe('when user has not edit permission in folders', () => {
        it('should have disabled the Move button', () => __awaiter(void 0, void 0, void 0, function* () {
            contextSrv.hasEditPermissionInFolders = false;
            const mockItemsSelected = new Map();
            const mockDashboardsUIDsSelected = new Set();
            mockDashboardsUIDsSelected.add('uid1');
            mockDashboardsUIDsSelected.add('uid2');
            mockItemsSelected.set('dashboard', mockDashboardsUIDsSelected);
            //Mock store
            const mockStore = configureMockStore();
            const store = mockStore({ dashboard: { panels: [] } });
            const onChange = jest.fn();
            const clearSelection = jest.fn();
            render(React.createElement(Provider, { store: store },
                React.createElement(ManageActions, { items: mockItemsSelected, onChange: onChange, clearSelection: clearSelection })));
            expect(screen.getByTestId('manage-actions')).toBeInTheDocument();
            expect(yield screen.findByRole('button', { name: 'Move', hidden: true })).toBeDisabled();
            yield userEvent.click(screen.getByRole('button', { name: 'Move', hidden: true }));
            expect(screen.queryByText(/Choose Dashboard Folder/i)).toBeNull();
        }));
    });
    describe('When user has selected General folder', () => {
        contextSrv.hasEditPermissionInFolders = true;
        const mockItemsSelected = new Map();
        const mockFolderUIDSelected = new Set();
        mockFolderUIDSelected.add('general');
        mockItemsSelected.set('folder', mockFolderUIDSelected);
        //Mock store
        const mockStore = configureMockStore();
        const store = mockStore({ dashboard: { panels: [] } });
        const onChange = jest.fn();
        const clearSelection = jest.fn();
        it('should disable the Delete button', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(Provider, { store: store },
                React.createElement(ManageActions, { items: mockItemsSelected, onChange: onChange, clearSelection: clearSelection })));
            expect(screen.getByTestId('manage-actions')).toBeInTheDocument();
            expect(yield screen.findByRole('button', { name: 'Delete', hidden: true })).toBeDisabled();
        }));
    });
});
//# sourceMappingURL=ManageActions.test.js.map