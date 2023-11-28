import { __awaiter } from "tslib";
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/__mocks__/backend_srv';
import * as api from 'app/features/manage-dashboards/state/actions';
import { MoveModal } from './MoveModal';
function render(...[ui, options]) {
    rtlRender(React.createElement(TestProvider, null, ui), options);
}
describe('browse-dashboards MoveModal', () => {
    const mockOnDismiss = jest.fn();
    const mockOnConfirm = jest.fn();
    const mockFolders = [
        { title: 'General', uid: '' },
        { title: 'Folder 1', uid: 'wfTJJL5Wz' },
    ];
    let props;
    beforeAll(() => {
        setBackendSrv(backendSrv);
        jest.spyOn(backendSrv, 'get').mockResolvedValue({
            dashboard: 0,
            folder: 0,
        });
    });
    beforeEach(() => {
        props = {
            isOpen: true,
            onConfirm: mockOnConfirm,
            onDismiss: mockOnDismiss,
            selectedItems: {
                $all: false,
                folder: {},
                dashboard: {},
                panel: {},
            },
        };
        // mock the searchFolders api call so the folder picker has some folders in it
        jest.spyOn(api, 'searchFolders').mockResolvedValue(mockFolders);
    });
    it('renders a dialog with the correct title', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MoveModal, Object.assign({}, props)));
        expect(yield screen.findByRole('dialog', { name: 'Move' })).toBeInTheDocument();
    }));
    it('displays a `Move` button', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MoveModal, Object.assign({}, props)));
        expect(yield screen.findByRole('button', { name: 'Move' })).toBeInTheDocument();
    }));
    it('displays a `Cancel` button', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MoveModal, Object.assign({}, props)));
        expect(yield screen.findByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    }));
    it('displays a folder picker', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MoveModal, Object.assign({}, props)));
        expect(yield screen.findByRole('combobox', { name: 'Select a folder' })).toBeInTheDocument();
    }));
    it('displays a warning about permissions if a folder is selected', () => __awaiter(void 0, void 0, void 0, function* () {
        props.selectedItems.folder = {
            myFolderUid: true,
        };
        render(React.createElement(MoveModal, Object.assign({}, props)));
        expect(yield screen.findByRole('status', { name: 'Moving this item may change its permissions.' })).toBeInTheDocument();
    }));
    it('only enables the `Move` button if a folder is selected', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MoveModal, Object.assign({}, props)));
        expect(yield screen.findByRole('button', { name: 'Move' })).toBeDisabled();
        const folderPicker = yield screen.findByRole('combobox', { name: 'Select a folder' });
        yield selectOptionInTest(folderPicker, mockFolders[1].title);
        expect(yield screen.findByRole('button', { name: 'Move' })).toBeEnabled();
    }));
    it('calls onConfirm when clicking the `Move` button', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MoveModal, Object.assign({}, props)));
        const folderPicker = yield screen.findByRole('combobox', { name: 'Select a folder' });
        yield selectOptionInTest(folderPicker, mockFolders[1].title);
        yield userEvent.click(yield screen.findByRole('button', { name: 'Move' }));
        expect(mockOnConfirm).toHaveBeenCalledWith(mockFolders[1].uid);
    }));
    it('calls onDismiss when clicking the `Cancel` button', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MoveModal, Object.assign({}, props)));
        yield userEvent.click(yield screen.findByRole('button', { name: 'Cancel' }));
        expect(mockOnDismiss).toHaveBeenCalled();
    }));
    it('calls onDismiss when clicking the X', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MoveModal, Object.assign({}, props)));
        yield userEvent.click(yield screen.findByRole('button', { name: 'Close' }));
        expect(mockOnDismiss).toHaveBeenCalled();
    }));
});
//# sourceMappingURL=MoveModal.test.js.map