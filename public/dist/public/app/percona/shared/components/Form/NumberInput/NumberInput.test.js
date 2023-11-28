import { __awaiter } from "tslib";
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { FormWrapper } from 'app/percona/shared/helpers/utils';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { NumberInputField } from './NumberInputField';
describe('NumberInputField::', () => {
    it('should render an input element of type number and two buttons', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(NumberInputField, { name: "test" })));
        const input = screen.getByTestId('test-number-input');
        expect(input).toBeInTheDocument();
        expect(input).toHaveProperty('type', 'number');
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(2);
    }));
    it('should call passed validators', () => {
        const validatorOne = jest.fn();
        const validatorTwo = jest.fn();
        render(React.createElement(FormWrapper, null,
            React.createElement(NumberInputField, { name: "test", validators: [validatorOne, validatorTwo] })));
        expect(validatorOne).toBeCalledTimes(1);
        expect(validatorTwo).toBeCalledTimes(1);
    });
    it('should show an error on invalid input', () => __awaiter(void 0, void 0, void 0, function* () {
        const validatorOne = jest.fn().mockReturnValue('some error');
        const validatorTwo = jest.fn();
        render(React.createElement(FormWrapper, null,
            React.createElement(NumberInputField, { name: "test", validators: [validatorOne, validatorTwo] })));
        const errorMessage = screen.getByTestId('test-field-error-message');
        expect(errorMessage).toHaveTextContent('');
        expect(validatorOne).toBeCalledTimes(1);
        expect(validatorTwo).toBeCalledTimes(0);
        const input = yield screen.getByTestId('test-number-input');
        fireEvent.change(input, { target: { value: 'invalid' } });
        fireEvent.blur(input);
        expect(yield screen.findByText('some error')).toBeInTheDocument();
        expect(validatorOne).toBeCalledTimes(1);
        expect(validatorTwo).toBeCalledTimes(0);
    }));
    it('should show validation errors on blur if specified', () => __awaiter(void 0, void 0, void 0, function* () {
        const validatorOne = jest.fn();
        const validatorTwo = jest.fn().mockReturnValue('some error');
        render(React.createElement(FormWrapper, null,
            React.createElement(NumberInputField, { showErrorOnBlur: true, name: "test", validators: [validatorOne, validatorTwo] })));
        const input = yield screen.getByTestId('test-number-input');
        fireEvent.change(input, { target: { value: 'invalid' } });
        expect(validatorOne).toBeCalledTimes(1);
        expect(validatorTwo).toBeCalledTimes(1);
        expect(yield screen.queryByText('some error')).not.toBeInTheDocument();
        fireEvent.blur(input);
        expect(yield screen.findByText('some error')).toBeInTheDocument();
    }));
    it('should show validation errors on render if specified', () => __awaiter(void 0, void 0, void 0, function* () {
        const validatorOne = jest.fn();
        const validatorTwo = jest.fn().mockReturnValue('some error');
        render(React.createElement(FormWrapper, null,
            React.createElement(NumberInputField, { showErrorOnRender: true, name: "test", validators: [validatorOne, validatorTwo] })));
        expect(validatorOne).toBeCalledTimes(1);
        expect(validatorTwo).toBeCalledTimes(1);
        expect(yield screen.queryByText('some error')).toBeInTheDocument();
    }));
    it('should show no labels if none is specified', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(NumberInputField, { name: "test" })));
        expect(screen.queryByTestId('test-field-label')).not.toBeInTheDocument();
    });
    it('should show a label if one is specified', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(NumberInputField, { label: "test label", name: "test" })));
        expect(yield screen.getByTestId('test-field-label')).toBeInTheDocument();
        expect(yield screen.findByText('test label')).toBeInTheDocument();
    }));
    it('should show an asterisk on the label if the field is required', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(NumberInputField, { label: "test label", name: "test", required: true })));
        expect(yield screen.getByTestId('test-field-label')).toBeInTheDocument();
        expect(yield screen.findByText('test label *')).toBeInTheDocument();
    }));
    it('should hide arrow buttons when disabled', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(NumberInputField, { name: "test", disabled: true })));
        expect(yield screen.getByTestId('test-number-input')).toHaveAttribute('disabled');
        expect(yield screen.queryByRole('button')).not.toBeInTheDocument();
    }));
    it('should apply the passed class name to the inner input element', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(NumberInputField, { name: "test", className: "testClass" })));
        expect(screen.getByTestId('test-number-input').classList.contains('testClass')).toBe(true);
    });
    it('should change the value when clicking on the arrow buttons', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(NumberInputField, { name: "test" })));
        const buttons = yield screen.getAllByRole('button');
        expect(buttons).toHaveLength(2);
        fireEvent.click(buttons[0]);
        expect(yield screen.getByTestId('test-number-input')).toHaveAttribute('value', '1');
        fireEvent.click(buttons[1]);
        expect(yield screen.getByTestId('test-number-input')).toHaveAttribute('value', '0');
    }));
    it('should accept any valid input html attributes and pass them over to the input tag', () => __awaiter(void 0, void 0, void 0, function* () {
        const title = 'Titolo di viaggio';
        const onChange = jest.fn();
        const greaterThan100 = validators.greaterThan(100);
        render(React.createElement(FormWrapper, null,
            React.createElement(NumberInputField, { name: "test", inputProps: {
                    autoComplete: 'off',
                    onChange,
                    title,
                }, validators: [greaterThan100], initialValue: 100 })));
        const input = yield screen.getByTestId('test-number-input');
        expect(input).toHaveAttribute('value', '100');
        fireEvent.change(input, { target: { value: '1' } });
        fireEvent.blur(input);
        expect(yield screen.getByTestId('test-field-error-message')).toHaveTextContent('Must be a number greater than 100');
        expect(input).toHaveAttribute('autocomplete', 'off');
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(input).toHaveAttribute('title', title);
    }));
});
//# sourceMappingURL=NumberInput.test.js.map