import { __awaiter } from "tslib";
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { config } from '@grafana/runtime';
import { appEvents } from 'app/core/core';
import { ShowModalReactEvent } from 'app/types/events';
import { mockFolderDTO } from '../fixtures/folder.fixture';
import * as permissions from '../permissions';
import { DeleteModal } from './BrowseActions/DeleteModal';
import { MoveModal } from './BrowseActions/MoveModal';
import { FolderActionsButton } from './FolderActionsButton';
function render(...[ui, options]) {
    rtlRender(React.createElement(TestProvider, null, ui), options);
}
// Mock out the Permissions component for now
jest.mock('app/core/components/AccessControl', () => ({
    Permissions: () => React.createElement("div", null, "Hello!"),
}));
describe('browse-dashboards FolderActionsButton', () => {
    const mockFolder = mockFolderDTO();
    const mockPermissions = {
        canCreateDashboards: true,
        canEditDashboards: true,
        canCreateFolders: true,
        canDeleteFolders: true,
        canEditFolders: true,
        canViewPermissions: true,
        canSetPermissions: true,
    };
    beforeEach(() => {
        jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => mockPermissions);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });
    describe('with nestedFolders enabled', () => {
        beforeAll(() => {
            config.featureToggles.nestedFolders = true;
        });
        afterAll(() => {
            config.featureToggles.nestedFolders = false;
        });
        it('does not render anything when the user has no permissions to do anything', () => {
            jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
                return Object.assign(Object.assign({}, mockPermissions), { canDeleteFolders: false, canEditFolders: false, canViewPermissions: false, canSetPermissions: false });
            });
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            expect(screen.queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
        });
        it('renders a "Folder actions" button when the user has permissions to do something', () => {
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            expect(screen.getByRole('button', { name: 'Folder actions' })).toBeInTheDocument();
        });
        it('renders all the options if the user has full permissions', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            yield userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
            expect(screen.getByRole('menuitem', { name: 'Manage permissions' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Move' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
        }));
        it('does not render the "Manage permissions" option if the user does not have permission to view permissions', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
                return Object.assign(Object.assign({}, mockPermissions), { canViewPermissions: false });
            });
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            yield userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
            expect(screen.queryByRole('menuitem', { name: 'Manage permissions' })).not.toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Move' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
        }));
        it('does not render the "Move" option if the user does not have permission to edit', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
                return Object.assign(Object.assign({}, mockPermissions), { canEditFolders: false });
            });
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            yield userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
            expect(screen.getByRole('menuitem', { name: 'Manage permissions' })).toBeInTheDocument();
            expect(screen.queryByRole('menuitem', { name: 'Move' })).not.toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
        }));
        it('does not render the "Delete" option if the user does not have permission to delete', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
                return Object.assign(Object.assign({}, mockPermissions), { canDeleteFolders: false });
            });
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            yield userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
            expect(screen.getByRole('menuitem', { name: 'Manage permissions' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Move' })).toBeInTheDocument();
            expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
        }));
        it('clicking the "Manage permissions" option opens the permissions drawer', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            yield userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
            yield userEvent.click(screen.getByRole('menuitem', { name: 'Manage permissions' }));
            expect(screen.getByRole('dialog', { name: 'Drawer title Manage permissions' })).toBeInTheDocument();
        }));
        it('clicking the "Move" option opens the move modal', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(appEvents, 'publish');
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            yield userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
            yield userEvent.click(screen.getByRole('menuitem', { name: 'Move' }));
            expect(appEvents.publish).toHaveBeenCalledWith(new ShowModalReactEvent(expect.objectContaining({
                component: MoveModal,
            })));
        }));
        it('clicking the "Delete" option opens the delete modal', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(appEvents, 'publish');
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            yield userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
            yield userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
            expect(appEvents.publish).toHaveBeenCalledWith(new ShowModalReactEvent(expect.objectContaining({
                component: DeleteModal,
            })));
        }));
    });
    describe('with nestedFolders disabled', () => {
        it('does not render anything when the user has no permissions to do anything', () => {
            jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
                return Object.assign(Object.assign({}, mockPermissions), { canDeleteFolders: false, canEditFolders: false, canViewPermissions: false, canSetPermissions: false });
            });
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            expect(screen.queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
        });
        it('renders a "Folder actions" button when the user has permissions to do something', () => {
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            expect(screen.getByRole('button', { name: 'Folder actions' })).toBeInTheDocument();
        });
        it('does not render a "Move" button even if it has permissions', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            yield userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
            expect(screen.queryByRole('menuitem', { name: 'Move' })).not.toBeInTheDocument();
        }));
        it('renders all the options if the user has full permissions', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            yield userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
            expect(screen.getByRole('menuitem', { name: 'Manage permissions' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
        }));
        it('does not render the "Manage permissions" option if the user does not have permission to view permissions', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
                return Object.assign(Object.assign({}, mockPermissions), { canViewPermissions: false });
            });
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            yield userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
            expect(screen.queryByRole('menuitem', { name: 'Manage permissions' })).not.toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
        }));
        it('does not render the "Move" option if the user does not have permission to edit', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
                return Object.assign(Object.assign({}, mockPermissions), { canEditFolders: false });
            });
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            yield userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
            expect(screen.getByRole('menuitem', { name: 'Manage permissions' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
        }));
        it('does not render the "Delete" option if the user does not have permission to delete', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
                return Object.assign(Object.assign({}, mockPermissions), { canDeleteFolders: false });
            });
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            yield userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
            expect(screen.getByRole('menuitem', { name: 'Manage permissions' })).toBeInTheDocument();
            expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
        }));
        it('clicking the "Manage permissions" option opens the permissions drawer', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            yield userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
            yield userEvent.click(screen.getByRole('menuitem', { name: 'Manage permissions' }));
            expect(screen.getByRole('dialog', { name: 'Drawer title Manage permissions' })).toBeInTheDocument();
        }));
        it('clicking the "Delete" option opens the delete modal', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(appEvents, 'publish');
            render(React.createElement(FolderActionsButton, { folder: mockFolder }));
            yield userEvent.click(screen.getByRole('button', { name: 'Folder actions' }));
            yield userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
            expect(appEvents.publish).toHaveBeenCalledWith(new ShowModalReactEvent(expect.objectContaining({
                component: DeleteModal,
            })));
        }));
    });
});
//# sourceMappingURL=FolderActionsButton.test.js.map