import { __awaiter } from "tslib";
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { DeleteModal } from './DeleteModal';
function render(...[ui, options]) {
    rtlRender(React.createElement(TestProvider, null, ui), options);
}
describe('browse-dashboards DeleteModal', () => {
    const mockOnDismiss = jest.fn();
    const mockOnConfirm = jest.fn();
    const defaultProps = {
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
    it('renders a dialog with the correct title', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(DeleteModal, Object.assign({}, defaultProps)));
        expect(yield screen.findByRole('dialog', { name: 'Delete' })).toBeInTheDocument();
    }));
    it('displays a `Delete` button', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(DeleteModal, Object.assign({}, defaultProps)));
        expect(yield screen.findByRole('button', { name: 'Delete' })).toBeInTheDocument();
    }));
    it('displays a `Cancel` button', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(DeleteModal, Object.assign({}, defaultProps)));
        expect(yield screen.findByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    }));
    it('only enables the `Delete` button if the confirmation text is typed', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(DeleteModal, Object.assign({}, defaultProps)));
        const confirmationInput = yield screen.findByPlaceholderText('Type "Delete" to confirm');
        yield userEvent.type(confirmationInput, 'Delete');
        expect(yield screen.findByRole('button', { name: 'Delete' })).toBeEnabled();
    }));
    it('calls onConfirm when clicking the `Delete` button', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(DeleteModal, Object.assign({}, defaultProps)));
        const confirmationInput = yield screen.findByPlaceholderText('Type "Delete" to confirm');
        yield userEvent.type(confirmationInput, 'Delete');
        yield userEvent.click(yield screen.findByRole('button', { name: 'Delete' }));
        expect(mockOnConfirm).toHaveBeenCalled();
    }));
    it('calls onDismiss when clicking the `Cancel` button', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(DeleteModal, Object.assign({}, defaultProps)));
        yield userEvent.click(yield screen.findByRole('button', { name: 'Cancel' }));
        expect(mockOnDismiss).toHaveBeenCalled();
    }));
    it('calls onDismiss when clicking the X', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(DeleteModal, Object.assign({}, defaultProps)));
        yield userEvent.click(yield screen.findByRole('button', { name: 'Close' }));
        expect(mockOnDismiss).toHaveBeenCalled();
    }));
});
//# sourceMappingURL=DeleteModal.test.js.map