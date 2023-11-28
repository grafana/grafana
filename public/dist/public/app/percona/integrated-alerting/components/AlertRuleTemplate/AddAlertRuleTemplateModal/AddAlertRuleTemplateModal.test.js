import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AddAlertRuleTemplateModal } from './AddAlertRuleTemplateModal';
jest.mock('../AlertRuleTemplate.service');
jest.mock('app/core/app_events');
describe('AddAlertRuleTemplateModal', () => {
    it('should render component correctly', () => {
        render(React.createElement(AddAlertRuleTemplateModal, { setVisible: jest.fn(), getAlertRuleTemplates: jest.fn(), isVisible: true }));
        expect(screen.getByRole('textbox')).toBeTruthy();
        expect(screen.getByTestId('alert-rule-template-upload-button')).toBeTruthy();
        expect(screen.getByTestId('alert-rule-template-cancel-button')).toBeTruthy();
        expect(screen.getByTestId('alert-rule-template-add-button')).toBeTruthy();
        expect(screen.getByTestId('alert-rule-template-add-button')).toBeDisabled();
    });
    it('should not render modal when visible is set to false', () => {
        render(React.createElement(AddAlertRuleTemplateModal, { setVisible: jest.fn(), getAlertRuleTemplates: jest.fn(), isVisible: false }));
        expect(screen.queryByRole('textarea')).toBeFalsy();
    });
    it('should call setVisible on close', () => {
        const setVisible = jest.fn();
        render(React.createElement(AddAlertRuleTemplateModal, { setVisible: setVisible, getAlertRuleTemplates: jest.fn(), isVisible: true }));
        const background = screen.getByTestId('modal-background');
        fireEvent.click(background);
        expect(setVisible).toHaveBeenCalled();
    });
    it('should call setVisible and getAlertRuleTemplates on submit', () => __awaiter(void 0, void 0, void 0, function* () {
        const setVisible = jest.fn();
        const getAlertRuleTemplates = jest.fn();
        render(React.createElement(AddAlertRuleTemplateModal, { setVisible: setVisible, getAlertRuleTemplates: getAlertRuleTemplates, isVisible: true }));
        const textbox = screen.getByRole('textbox');
        fireEvent.change(textbox, { target: { value: 'test content' } });
        const form = screen.getByTestId('add-alert-rule-template-modal-form');
        yield waitFor(() => fireEvent.submit(form));
        expect(setVisible).toHaveBeenCalledWith(false);
        expect(getAlertRuleTemplates).toHaveBeenCalled();
    }));
});
//# sourceMappingURL=AddAlertRuleTemplateModal.test.js.map