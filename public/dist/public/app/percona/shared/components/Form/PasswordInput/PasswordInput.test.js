import { __awaiter } from "tslib";
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { FormWrapper } from 'app/percona/shared/helpers/utils';
import { PasswordInputField } from './PasswordInputField';
describe('PasswordInputField::', () => {
    it('should render an input element of type password', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(PasswordInputField, { name: "test" })));
        const input = yield screen.getByTestId('test-password-input');
        expect(input).toBeInTheDocument();
        expect(input).toHaveProperty('type', 'password');
    }));
    it('should call passed validators', () => {
        const validatorOne = jest.fn();
        const validatorTwo = jest.fn();
        render(React.createElement(FormWrapper, null,
            React.createElement(PasswordInputField, { name: "test", validators: [validatorOne, validatorTwo] })));
        expect(validatorOne).toBeCalledTimes(1);
        expect(validatorTwo).toBeCalledTimes(1);
    });
    it('should show an error on invalid input', () => __awaiter(void 0, void 0, void 0, function* () {
        const validatorOne = jest.fn().mockReturnValue('some error');
        const validatorTwo = jest.fn();
        render(React.createElement(FormWrapper, null,
            React.createElement(PasswordInputField, { name: "test", validators: [validatorOne, validatorTwo] })));
        const input = yield screen.getByTestId('test-password-input');
        expect(yield screen.findByTestId('test-field-error-message')).toBeEmptyDOMElement();
        expect(validatorOne).toBeCalledTimes(1);
        fireEvent.change(input, { target: { value: 'Test' } });
        expect(validatorOne).toBeCalledTimes(2);
        expect(validatorTwo).toBeCalledTimes(0);
        expect(yield screen.getByTestId('test-field-error-message')).toHaveTextContent('some error');
    }));
    it('should show validation errors on blur if specified', () => __awaiter(void 0, void 0, void 0, function* () {
        const validatorOne = jest.fn();
        const validatorTwo = jest.fn().mockReturnValue('some error');
        render(React.createElement(FormWrapper, null,
            React.createElement(PasswordInputField, { showErrorOnBlur: true, name: "test", validators: [validatorOne, validatorTwo] })));
        const input = yield screen.getByTestId('test-password-input');
        fireEvent.change(input, { target: { value: 'Test' } });
        expect(validatorOne).toBeCalledTimes(2);
        expect(validatorTwo).toBeCalledTimes(2);
        expect(yield screen.findByTestId('test-field-error-message')).toBeEmptyDOMElement();
        fireEvent.blur(input);
        expect(yield screen.findByTestId('test-field-error-message')).toHaveTextContent('some error');
    }));
    it('should show validation errors on render if specified', () => __awaiter(void 0, void 0, void 0, function* () {
        const validatorOne = jest.fn();
        const validatorTwo = jest.fn().mockReturnValue('some error');
        render(React.createElement(FormWrapper, null,
            React.createElement(PasswordInputField, { showErrorOnRender: true, name: "test", validators: [validatorOne, validatorTwo] })));
        expect(validatorOne).toBeCalledTimes(1);
        expect(validatorTwo).toBeCalledTimes(1);
        expect(yield screen.queryByText('some error')).toBeInTheDocument();
    }));
    it('should show no labels if none are specified', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(PasswordInputField, { name: "test" })));
        expect(screen.queryByTestId('test-field-label')).not.toBeInTheDocument();
    }));
    it('should show a label if one is specified', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(PasswordInputField, { label: "test label", name: "test" })));
        expect(yield screen.findByTestId('test-field-label')).toBeInTheDocument();
        expect(yield screen.findByTestId('test-field-label')).toHaveTextContent('test label');
    }));
    it('should show an asterisk on the label if the field is required', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(PasswordInputField, { label: "test label", name: "test", required: true })));
        expect(yield screen.findByTestId('test-field-label')).toBeInTheDocument();
        expect(yield screen.findByTestId('test-field-label')).toHaveTextContent('test label *');
    }));
    it('should not pass the required prop to the input if the field is required', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(PasswordInputField, { name: "test", required: true })));
        expect(yield screen.getByTestId('test-password-input')).toHaveProperty('required', false);
    }));
    it('should apply the passed class name to the inner input element', () => {
        const { container } = render(React.createElement(FormWrapper, null,
            React.createElement(PasswordInputField, { name: "test", className: "testClass" })));
        expect(container.querySelector('[data-testid="test-password-input"].testClass'));
    });
    it('should accept any valid input html attributes and pass them over to the input tag', () => __awaiter(void 0, void 0, void 0, function* () {
        const title = 'Titolo di stato';
        const onChange = jest.fn();
        render(React.createElement(FormWrapper, null,
            React.createElement(PasswordInputField, { name: "test", inputProps: {
                    autoComplete: 'off',
                    onChange,
                    title,
                }, initialValue: "password" })));
        const input = yield screen.getByTestId('test-password-input');
        expect(input).toHaveAttribute('value', 'password');
        fireEvent.change(input, { target: { value: '1' } });
        fireEvent.blur(input);
        expect(input).toHaveAttribute('autocomplete', 'off');
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(input).toHaveAttribute('title', title);
    }));
});
//# sourceMappingURL=PasswordInput.test.js.map