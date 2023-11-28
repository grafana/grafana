import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ProgressModal } from '../../components';
import { Messages } from './ProgressModal.messages';
describe('ProgressModal::', () => {
    const version = 'x.y.z';
    it('should be closed by default', () => {
        render(React.createElement(ProgressModal, { version: version }));
        expect(screen.queryByTestId('progress-modal-container')).not.toBeInTheDocument();
    });
    it('should show the upgrade in progress if isUpdated is false', () => {
        render(React.createElement(ProgressModal, { isOpen: true, version: version }));
        expect(screen.getByText(Messages.copyToClipboard)).toBeInTheDocument();
        expect(screen.getByTestId('modal-chevron-icon-angle-down')).toBeInTheDocument();
        expect(screen.getByTestId('modal-output-pre')).toBeInTheDocument();
        expect(screen.queryByTestId('modal-update-success-text')).not.toBeInTheDocument();
        expect(screen.queryByTestId('modal-close')).not.toBeInTheDocument();
    });
    it('should show a close button when isUpdated is true', () => {
        render(React.createElement(ProgressModal, { isOpen: true, isUpdated: true, version: version }));
        expect(screen.getByTestId('modal-update-success-text')).toBeInTheDocument();
        expect(screen.getByTestId('modal-close')).toBeInTheDocument();
        expect(screen.queryByTestId(Messages.copyToClipboard)).not.toBeInTheDocument();
        expect(screen.queryByTestId('modal-chevron-icon-angle-down')).not.toBeInTheDocument();
        expect(screen.queryByTestId('modal-output-pre')).not.toBeInTheDocument();
    });
    it('should toggle the upgrade output on click on the chevron icon', () => {
        render(React.createElement(ProgressModal, { isOpen: true, version: version }));
        const chevron = screen.getByTestId('modal-chevron-icon-angle-down');
        fireEvent.click(chevron);
        expect(chevron.getAttribute('data-testid')).toBe('modal-chevron-icon-angle-up');
        fireEvent.click(chevron);
        expect(chevron.getAttribute('data-testid')).toBe('modal-chevron-icon-angle-down');
    });
    it('should reload the page when the close button is clicked', () => {
        const mockedReload = jest.fn();
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { reload: mockedReload },
        });
        render(React.createElement(ProgressModal, { isOpen: true, isUpdated: true, version: version }));
        fireEvent.click(screen.getByTestId('modal-close'));
        expect(mockedReload).toBeCalledTimes(1);
    });
});
//# sourceMappingURL=ProgressModal.test.js.map