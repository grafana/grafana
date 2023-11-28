import { __awaiter } from "tslib";
import { render as rtlRender, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { mockFolderDTO } from '../fixtures/folder.fixture';
import CreateNewButton from './CreateNewButton';
const mockParentFolder = mockFolderDTO();
function render(...[ui, options]) {
    rtlRender(React.createElement(TestProvider, null, ui), options);
}
function renderAndOpen(folder) {
    return __awaiter(this, void 0, void 0, function* () {
        render(React.createElement(CreateNewButton, { canCreateDashboard: true, canCreateFolder: true, parentFolder: folder }));
        const newButton = screen.getByText('New');
        yield userEvent.click(newButton);
    });
}
describe('NewActionsButton', () => {
    it('should display the correct urls with a given parent folder', () => __awaiter(void 0, void 0, void 0, function* () {
        yield renderAndOpen(mockParentFolder);
        expect(screen.getByText('New dashboard')).toHaveAttribute('href', `/dashboard/new?folderUid=${mockParentFolder.uid}`);
        expect(screen.getByText('Import')).toHaveAttribute('href', `/dashboard/import?folderUid=${mockParentFolder.uid}`);
    }));
    it('should display urls without params when there is no parent folder', () => __awaiter(void 0, void 0, void 0, function* () {
        yield renderAndOpen();
        expect(screen.getByText('New dashboard')).toHaveAttribute('href', '/dashboard/new');
        expect(screen.getByText('Import')).toHaveAttribute('href', '/dashboard/import');
    }));
    it('clicking the "New folder" button opens the drawer', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(CreateNewButton, { canCreateDashboard: true, canCreateFolder: true, parentFolder: mockParentFolder }));
        const newButton = screen.getByText('New');
        yield userEvent.click(newButton);
        yield userEvent.click(screen.getByText('New folder'));
        const drawer = screen.getByRole('dialog', { name: 'Drawer title New folder' });
        expect(drawer).toBeInTheDocument();
        expect(within(drawer).getByRole('heading', { name: 'New folder' })).toBeInTheDocument();
        expect(within(drawer).getByText(`Location: ${mockParentFolder.title}`)).toBeInTheDocument();
    }));
    it('should only render dashboard items when folder creation is disabled', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(CreateNewButton, { canCreateDashboard: true, canCreateFolder: false }));
        const newButton = screen.getByText('New');
        yield userEvent.click(newButton);
        expect(screen.getByText('New dashboard')).toBeInTheDocument();
        expect(screen.getByText('Import')).toBeInTheDocument();
        expect(screen.queryByText('New folder')).not.toBeInTheDocument();
    }));
    it('should only render folder item when dashboard creation is disabled', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(CreateNewButton, { canCreateDashboard: false, canCreateFolder: true }));
        const newButton = screen.getByText('New');
        yield userEvent.click(newButton);
        expect(screen.queryByText('New dashboard')).not.toBeInTheDocument();
        expect(screen.queryByText('Import')).not.toBeInTheDocument();
        expect(screen.getByText('New folder')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=CreateNewButton.test.js.map