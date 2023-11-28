import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { DeleteModal } from './DeleteModal';
describe('DeleteModal', () => {
    it('should render modal', () => {
        render(React.createElement(DeleteModal, { setVisible: jest.fn(), onDelete: jest.fn(), isVisible: true }));
        expect(screen.getByTestId('confirm-delete-modal-button')).toBeInTheDocument();
        expect(screen.getByTestId('cancel-delete-modal-button')).toBeInTheDocument();
        expect(screen.getByTestId('confirm-delete-modal-button').querySelector('i')).not.toBeInTheDocument();
        expect(screen.queryByTestId('force-checkbox-field')).not.toBeInTheDocument();
    });
    it('should render modal with custom message and title', () => {
        render(React.createElement(DeleteModal, { title: "Test title", message: "Test message", setVisible: jest.fn(), onDelete: jest.fn(), isVisible: true }));
        expect(screen.getByText('Test title')).toBeTruthy();
        expect(screen.getByText('Test message')).toBeTruthy();
    });
    it('should not render modal when visible is set to false', () => {
        render(React.createElement(DeleteModal, { setVisible: jest.fn(), onDelete: jest.fn(), isVisible: false }));
        expect(screen.queryByTestId('confirm-delete-modal-button')).toBeFalsy();
        expect(screen.queryByTestId('cancel-delete-modal-button')).toBeFalsy();
    });
    it('should render spinner when loading', () => {
        render(React.createElement(DeleteModal, { setVisible: jest.fn(), onDelete: jest.fn(), isVisible: true, loading: true }));
        expect(screen.getByTestId('confirm-delete-modal-button').querySelector('i')).toBeTruthy();
    });
    it('should call setVisible on close', () => {
        const setVisible = jest.fn();
        render(React.createElement(DeleteModal, { setVisible: setVisible, onDelete: jest.fn(), isVisible: true }));
        const modalBackground = screen.getByTestId('modal-background');
        fireEvent.click(modalBackground);
        expect(setVisible).toHaveBeenCalled();
    });
    it('should call onDelete on submit', () => {
        const onDelete = jest.fn();
        render(React.createElement(DeleteModal, { setVisible: jest.fn(), onDelete: onDelete, isVisible: true }));
        const modalButton = screen.getByTestId('confirm-delete-modal-button');
        fireEvent.click(modalButton);
        expect(onDelete).toHaveBeenCalled();
    });
    it('should call setVisible on cancel', () => {
        const setVisible = jest.fn();
        render(React.createElement(DeleteModal, { setVisible: setVisible, onDelete: jest.fn(), isVisible: true }));
        const modalButton = screen.getByTestId('cancel-delete-modal-button');
        fireEvent.click(modalButton);
        expect(setVisible).toHaveBeenCalledWith(false);
    });
    it('should render children if any', () => {
        const Dummy = () => React.createElement("div", { "data-testid": "test-div" }, "test");
        render(React.createElement(DeleteModal, { setVisible: jest.fn(), onDelete: jest.fn(), isVisible: true },
            React.createElement(Dummy, null)));
        expect(screen.getByTestId('test-div')).toBeInTheDocument();
    });
    it('should render the force checkbox', () => {
        render(React.createElement(DeleteModal, { setVisible: jest.fn(), onDelete: jest.fn(), isVisible: true, showForce: true }));
        expect(screen.getByTestId('force-checkbox-input')).toBeInTheDocument();
    });
    it('should show the checkbox label', () => {
        render(React.createElement(DeleteModal, { setVisible: jest.fn(), onDelete: jest.fn(), isVisible: true, showForce: true, forceLabel: "force this" }));
        expect(screen.getByTestId('force-field-label').textContent).toBe('force this');
    });
});
//# sourceMappingURL=DeleteModal.test.js.map