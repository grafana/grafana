import { __awaiter } from "tslib";
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { TestProvider } from 'test/helpers/TestProvider';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { ModalManager } from 'app/core/services/ModalManager';
import { FolderSettingsPage } from './FolderSettingsPage';
import { setFolderTitle } from './state/reducers';
const setup = (propOverrides) => {
    const props = Object.assign(Object.assign({}, getRouteComponentProps()), { pageNav: {}, folderUid: '1234', folder: {
            id: 0,
            uid: '1234',
            title: 'loading',
            canSave: true,
            canDelete: true,
            url: 'url',
            hasChanged: false,
            version: 1,
            permissions: [],
            canViewFolderPermissions: true,
        }, getFolderByUid: jest.fn(), setFolderTitle: mockToolkitActionCreator(setFolderTitle), saveFolder: jest.fn(), deleteFolder: jest.fn() });
    Object.assign(props, propOverrides);
    render(React.createElement(TestProvider, null,
        React.createElement(FolderSettingsPage, Object.assign({}, props))));
};
describe('FolderSettingsPage', () => {
    it('should render without error', () => {
        expect(() => setup()).not.toThrow();
    });
    it('should enable save button when canSave is true and hasChanged is true', () => {
        setup({
            folder: {
                id: 1,
                uid: '1234',
                title: 'loading',
                canSave: true,
                canDelete: true,
                hasChanged: true,
                version: 1,
            },
        });
        const saveButton = screen.getByRole('button', { name: 'Save' });
        expect(saveButton).not.toBeDisabled();
    });
    it('should disable save button when canSave is false and hasChanged is false', () => {
        setup({
            folder: {
                id: 1,
                uid: '1234',
                title: 'loading',
                canSave: false,
                canDelete: true,
                hasChanged: false,
                version: 1,
            },
        });
        const saveButton = screen.getByRole('button', { name: 'Save' });
        expect(saveButton).toBeDisabled();
    });
    it('should disable save button when canSave is true and hasChanged is false', () => {
        setup({
            folder: {
                id: 1,
                uid: '1234',
                title: 'loading',
                canSave: true,
                canDelete: true,
                hasChanged: false,
                version: 1,
            },
        });
        const saveButton = screen.getByRole('button', { name: 'Save' });
        expect(saveButton).toBeDisabled();
    });
    it('should disable save button when canSave is false and hasChanged is true', () => {
        setup({
            folder: {
                id: 1,
                uid: '1234',
                title: 'loading',
                canSave: false,
                canDelete: true,
                hasChanged: true,
                version: 1,
            },
        });
        const saveButton = screen.getByRole('button', { name: 'Save' });
        expect(saveButton).toBeDisabled();
    });
    it('should call onSave when the saveButton is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockSaveFolder = jest.fn();
        const mockFolder = {
            id: 1,
            uid: '1234',
            title: 'loading',
            canSave: true,
            canDelete: true,
            hasChanged: true,
            version: 1,
        };
        setup({
            folder: mockFolder,
            saveFolder: mockSaveFolder,
        });
        const saveButton = screen.getByRole('button', { name: 'Save' });
        yield userEvent.click(saveButton);
        expect(mockSaveFolder).toHaveBeenCalledWith(mockFolder);
    }));
    it('should disable delete button when canDelete is false', () => {
        setup({
            folder: {
                id: 1,
                uid: '1234',
                title: 'loading',
                canSave: true,
                canDelete: false,
                hasChanged: true,
                version: 1,
            },
        });
        const deleteButton = screen.getByRole('button', { name: 'Delete' });
        expect(deleteButton).toBeDisabled();
    });
    it('should enable delete button when canDelete is true', () => {
        setup({
            folder: {
                id: 1,
                uid: '1234',
                title: 'loading',
                canSave: true,
                canDelete: true,
                hasChanged: true,
                version: 1,
            },
        });
        const deleteButton = screen.getByRole('button', { name: 'Delete' });
        expect(deleteButton).not.toBeDisabled();
    });
    it('should call the publish event when the deleteButton is clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        new ModalManager().init();
        const mockDeleteFolder = jest.fn();
        const mockFolder = {
            id: 1,
            uid: '1234',
            title: 'loading',
            canSave: true,
            canDelete: true,
            hasChanged: true,
            version: 1,
        };
        setup({
            folder: mockFolder,
            deleteFolder: mockDeleteFolder,
        });
        const deleteButton = screen.getByRole('button', { name: 'Delete' });
        yield userEvent.click(deleteButton);
        const deleteModal = screen.getByRole('dialog', { name: 'Delete' });
        expect(deleteModal).toBeInTheDocument();
        const deleteButtonModal = within(deleteModal).getByRole('button', { name: 'Delete' });
        yield userEvent.click(deleteButtonModal);
        expect(mockDeleteFolder).toHaveBeenCalledWith(mockFolder.uid);
    }));
});
//# sourceMappingURL=FolderSettingsPage.test.js.map