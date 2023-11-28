import { __awaiter } from "tslib";
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Modal } from './Modal';
describe('Modal window::', () => {
    it('should render modal successfully', () => __awaiter(void 0, void 0, void 0, function* () {
        const onClose = jest.fn();
        render(React.createElement(Modal, { onClose: onClose, isVisible: true, title: "test" }));
        expect(yield screen.findByTestId('modal-background')).toBeInTheDocument();
        expect(yield screen.findByTestId('modal-body')).toBeInTheDocument();
        expect(yield screen.findByTestId('modal-close-button')).toBeInTheDocument();
        expect(yield screen.findByTestId('modal-content')).toBeInTheDocument();
    }));
    it('should call onClose callback on close button click', () => __awaiter(void 0, void 0, void 0, function* () {
        const onClose = jest.fn();
        render(React.createElement(Modal, { onClose: onClose, isVisible: true, title: "test" }));
        expect(onClose).toBeCalledTimes(0);
        fireEvent.click(yield screen.findByTestId('modal-close-button'));
        expect(onClose).toBeCalledTimes(1);
    }));
    it('should NOT call onClose callback on escape when closeOnEscape is NOT set', () => {
        const onClose = jest.fn();
        render(React.createElement(Modal, { onClose: onClose, isVisible: true, closeOnEscape: false, title: "test" }));
        expect(onClose).toBeCalledTimes(0);
        const modal = screen.queryByTestId('modal-wrapper');
        expect(modal).toBeInTheDocument();
        if (modal) {
            fireEvent.keyDown(modal, { key: 'Escape', code: 'Escape' });
        }
        expect(onClose).toBeCalledTimes(0);
    });
    it('should call onClose callback on background click when closeOnClickaway is set by default', () => __awaiter(void 0, void 0, void 0, function* () {
        const onClose = jest.fn();
        render(React.createElement(Modal, { onClose: onClose, isVisible: true, title: "test" }));
        expect(onClose).toBeCalledTimes(0);
        fireEvent.click(yield screen.findByTestId('modal-background'));
        expect(onClose).toBeCalledTimes(1);
    }));
    it('should NOT call onClose callback on background click when closeOnClickaway is NOT set', () => __awaiter(void 0, void 0, void 0, function* () {
        const onClose = jest.fn();
        render(React.createElement(Modal, { onClose: onClose, isVisible: true, closeOnClickaway: false, title: "test" }));
        expect(onClose).toBeCalledTimes(0);
        userEvent.click(yield screen.findByTestId('modal-background'));
        expect(onClose).toBeCalledTimes(0);
    }));
});
//# sourceMappingURL=Modal.test.js.map