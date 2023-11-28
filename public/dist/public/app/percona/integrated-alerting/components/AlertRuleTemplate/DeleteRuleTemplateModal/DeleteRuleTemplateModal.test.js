import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { templateStubs } from '../__mocks__/alertRuleTemplateStubs';
import { DeleteRuleTemplateModal } from './DeleteRuleTemplateModal';
jest.mock('../AlertRuleTemplate.service');
jest.mock('app/core/app_events');
describe('DeleteRuleTemplateModal', () => {
    it('should render delete modal', () => {
        render(React.createElement(DeleteRuleTemplateModal, { template: templateStubs[0], setVisible: jest.fn(), getAlertRuleTemplates: jest.fn(), isVisible: true }));
        expect(screen.getByTestId('confirm-delete-modal-button')).toBeInTheDocument();
        expect(screen.getByTestId('cancel-delete-modal-button')).toBeInTheDocument();
    });
    it('should not render modal when visible is set to false', () => {
        render(React.createElement(DeleteRuleTemplateModal, { template: templateStubs[0], setVisible: jest.fn(), getAlertRuleTemplates: jest.fn(), isVisible: false }));
        expect(screen.queryByTestId('confirm-delete-modal-button')).not.toBeInTheDocument();
    });
    it('should call setVisible on close', () => {
        const setVisible = jest.fn();
        render(React.createElement(DeleteRuleTemplateModal, { template: templateStubs[0], setVisible: setVisible, getAlertRuleTemplates: jest.fn(), isVisible: true }));
        const background = screen.getByTestId('modal-background');
        fireEvent.click(background);
        expect(setVisible).toHaveBeenCalled();
    });
});
//# sourceMappingURL=DeleteRuleTemplateModal.test.js.map