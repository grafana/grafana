import { __awaiter } from "tslib";
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { FormWrapper } from 'app/percona/shared/helpers/utils';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { SelectField } from './SelectFieldCore';
const { email, minLength } = validators;
const optionsTemplate = [
    {
        value: 'tes@mail.ru',
        label: 'tes@mail.ru (minLength error)',
    },
    {
        value: 'test@gmailcom',
        label: 'test@gmailcom (wrong email)',
    },
    {
        value: 'test@gmail.com',
        label: 'test@gmail.com (email example without errors)',
    },
];
describe('SelectField::', () => {
    it('should render a field container with input', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = render(React.createElement(FormWrapper, null,
            React.createElement(SelectField, { name: "test" })));
        expect(screen.getByTestId('test-field-container'));
        expect(container.querySelector('input')).toBeInTheDocument();
    }));
    it('should render a label', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(SelectField, { name: "test", label: "test label" })));
        expect(screen.getByTestId('test-field-label')).toBeInTheDocument();
        expect(screen.getByTestId('test-field-label')).toHaveTextContent('test label');
    });
    it('should react on multiple validators', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(SelectField, { name: "test", label: "test-label", validators: [email, minLength(13)], options: optionsTemplate, isOpen: true })));
        const menuOptions = screen.getAllByLabelText('Select option');
        fireEvent.click(menuOptions[0]);
        expect(screen.getByTestId('test-field-error-message')).toHaveTextContent('Must contain at least 13 characters');
        fireEvent.click(menuOptions[1]);
        expect(screen.getByTestId('test-field-error-message')).toHaveTextContent('Invalid email address');
        fireEvent.click(menuOptions[2]);
        expect(screen.getByTestId('test-field-error-message')).toHaveTextContent('');
    }));
    it('should show an error below the input', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(SelectField, { name: "test", label: "test-label", validators: [minLength(13)], options: optionsTemplate, isOpen: true })));
        const menuOptions = screen.getAllByLabelText('Select option');
        fireEvent.click(menuOptions[0]);
        expect(screen.getByTestId('test-field-error-message')).toHaveTextContent('Must contain at least 13 characters');
    }));
});
//# sourceMappingURL=SelectFieldCore.test.js.map