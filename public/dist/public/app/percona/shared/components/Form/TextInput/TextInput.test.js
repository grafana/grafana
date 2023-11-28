import { __awaiter } from "tslib";
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { FormWrapper } from 'app/percona/shared/helpers/utils';
import { email } from '../../../helpers/validatorsForm';
import { TextInputField } from './TextInputField';
describe('TextInputField::', () => {
    it('should render an input element of type text', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(TextInputField, { name: "test" })));
        expect(yield screen.findByRole('textbox')).toBeInTheDocument();
    }));
    it('should call passed validators', () => __awaiter(void 0, void 0, void 0, function* () {
        const validatorOne = jest.fn();
        const validatorTwo = jest.fn();
        render(React.createElement(FormWrapper, null,
            React.createElement(TextInputField, { name: "test", validators: [validatorOne, validatorTwo] })));
        expect(validatorOne).toBeCalledTimes(1);
        expect(validatorTwo).toBeCalledTimes(1);
    }));
    it('should show an error on invalid input', () => {
        const validatorOne = jest.fn().mockReturnValue('some error');
        const validatorTwo = jest.fn();
        render(React.createElement(FormWrapper, null,
            React.createElement(TextInputField, { name: "test", validators: [validatorOne, validatorTwo] })));
        expect(screen.getByTestId('test-field-error-message')).toBeEmptyDOMElement();
        expect(validatorOne).toBeCalledTimes(1);
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Test' } });
        expect(validatorOne).toBeCalledTimes(2);
        expect(validatorTwo).toBeCalledTimes(0);
        expect(screen.getByTestId('test-field-error-message')).toHaveTextContent('some error');
    });
    it('should show validation errors on blur if specified', () => {
        const validatorOne = jest.fn();
        const validatorTwo = jest.fn().mockReturnValue('some error');
        render(React.createElement(FormWrapper, null,
            React.createElement(TextInputField, { showErrorOnBlur: true, name: "test", validators: [validatorOne, validatorTwo] })));
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Test' } });
        expect(validatorOne).toBeCalledTimes(2);
        expect(validatorTwo).toBeCalledTimes(2);
        expect(screen.getByTestId('test-field-error-message')).toBeEmptyDOMElement();
        fireEvent.blur(input);
        expect(screen.getByTestId('test-field-error-message')).toHaveTextContent('some error');
    });
    it('should show validation errors on render if specified', () => __awaiter(void 0, void 0, void 0, function* () {
        const validatorOne = jest.fn();
        const validatorTwo = jest.fn().mockReturnValue('some error');
        render(React.createElement(FormWrapper, null,
            React.createElement(TextInputField, { showErrorOnRender: true, name: "test", validators: [validatorOne, validatorTwo] })));
        expect(validatorOne).toBeCalledTimes(1);
        expect(validatorTwo).toBeCalledTimes(1);
        expect(yield screen.queryByText('some error')).toBeInTheDocument();
    }));
    it("shouldn't show validation error of email if field is not required", () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(TextInputField, { showErrorOnRender: true, name: "test", validators: [email] })));
        const field = screen.getByTestId('test-text-input');
        fireEvent.change(field, { target: { value: '' } });
        expect(screen.getByTestId('test-field-error-message')).toHaveTextContent('');
    }));
    it('should show no labels if none are passed to props', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(TextInputField, { name: "test" })));
        expect(screen.queryByTestId('test-field-label')).not.toBeInTheDocument();
    });
    it('should show a label if one is passed to props', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(TextInputField, { label: "test label", name: "test" })));
        expect(screen.getByTestId('test-field-label')).toHaveTextContent('test label');
    });
    it('should show an asterisk on the label if the field is required', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(TextInputField, { label: "test label", name: "test", required: true })));
        expect(screen.getByTestId('test-field-label')).toHaveTextContent('test label *');
    });
    it('should not pass the required prop to the input if the field is required', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(TextInputField, { name: "test", required: true })));
        expect(screen.getByRole('textbox')).not.toHaveAttribute('required', true);
    });
    it('should apply the passed class name to the inner input element', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(TextInputField, { name: "test", className: "testClass" })));
        expect(screen.getByRole('textbox').classList.contains('testClass'));
    });
    it('should accept any valid input html attributes and pass them over to the input tag', () => {
        const title = 'Pomodori di riso al forno';
        const onChange = jest.fn();
        render(React.createElement(FormWrapper, null,
            React.createElement(TextInputField, { name: "test", inputProps: {
                    autoComplete: 'off',
                    onChange,
                    title,
                } })));
        const input = screen.getByTestId('test-text-input');
        fireEvent.change(input, { target: { value: 'foo' } });
        expect(input).toHaveAttribute('autocomplete', 'off');
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(input).toHaveAttribute('title', title);
    });
});
//# sourceMappingURL=TextInput.test.js.map