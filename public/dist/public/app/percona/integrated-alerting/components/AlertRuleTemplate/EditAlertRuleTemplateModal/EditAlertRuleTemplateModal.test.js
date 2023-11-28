import { __awaiter } from "tslib";
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { EditAlertRuleTemplateModal } from './EditAlertRuleTemplateModal';
jest.mock('../AlertRuleTemplate.service');
jest.mock('app/core/app_events');
describe('EditAlertRuleTemplateModal', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    it('should render component correctly', () => {
        const { container } = render(React.createElement(EditAlertRuleTemplateModal, { name: "template-1", summary: "summary", setVisible: jest.fn(), isVisible: true, yaml: "", getAlertRuleTemplates: jest.fn() }));
        const addButton = screen.getByTestId('alert-rule-template-edit-button');
        expect(container.querySelector('textarea')).toBeTruthy();
        expect(addButton).toBeInTheDocument();
        expect(addButton).toBeDisabled();
        expect(screen.getByTestId('alert-rule-template-cancel-button')).toBeInTheDocument();
        expect(screen.getByTestId('alert-rule-name-warning')).toBeInTheDocument();
    });
    it('should not render modal when visible is set to false', () => {
        const { container } = render(React.createElement(EditAlertRuleTemplateModal, { name: "template-1", summary: "summary", setVisible: jest.fn(), isVisible: false, yaml: "", getAlertRuleTemplates: jest.fn() }));
        expect(container.querySelector('textarea')).not.toBeInTheDocument();
    });
    it('should call setVisible on close', () => {
        const setVisible = jest.fn();
        render(React.createElement(EditAlertRuleTemplateModal, { name: "template-1", summary: "summary", setVisible: setVisible, isVisible: true, yaml: "", getAlertRuleTemplates: jest.fn() }));
        const background = screen.getByTestId('modal-background');
        fireEvent.click(background);
        expect(setVisible).toHaveBeenCalled();
    });
    it('should render yaml content passed', () => {
        const { container } = render(React.createElement(EditAlertRuleTemplateModal, { name: "template-1", summary: "summary", setVisible: jest.fn(), isVisible: true, yaml: "test content", getAlertRuleTemplates: jest.fn() }));
        expect(container.querySelector('textarea')).toHaveTextContent('test content');
        expect(screen.getByTestId('alert-rule-template-edit-button')).toBeDisabled();
    });
    it('should call setVisible and getAlertRuleTemplates on submit', () => __awaiter(void 0, void 0, void 0, function* () {
        const setVisible = jest.fn();
        const getAlertRuleTemplates = jest.fn();
        render(React.createElement(EditAlertRuleTemplateModal, { name: "template-1", summary: "summary", setVisible: setVisible, isVisible: true, yaml: "", getAlertRuleTemplates: getAlertRuleTemplates }));
        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'test content' } });
        const form = screen.getByTestId('edit-alert-rule-template-form');
        yield waitFor(() => fireEvent.submit(form));
        expect(setVisible).toHaveBeenCalledWith(false);
        expect(getAlertRuleTemplates).toHaveBeenCalled();
    }));
});
//# sourceMappingURL=EditAlertRuleTemplateModal.test.js.map