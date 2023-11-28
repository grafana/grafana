import { __awaiter } from "tslib";
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { FormWrapper } from 'app/percona/shared/helpers/utils';
import { RadioButtonGroupField } from './RadioButtonGroupField';
const options = [
    { label: 'Lowest', value: 'lowest', icon: 'bolt' },
    { label: 'Medium', value: 'medium', icon: 'arrow-right' },
    { label: 'High', value: 'high', icon: 'arrow-up' },
    { label: 'Highest', value: 'highest', icon: 'cloud' },
];
const initialValues = { test: 'lowest' };
describe('RadioButtonGroupField::', () => {
    it('should render as many RadioButtons as there are options', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(RadioButtonGroupField, { name: "test", options: options })));
        const buttons = yield screen.getAllByTestId('test-radio-button');
        expect(buttons).toHaveLength(4);
        expect(buttons[0]).toHaveProperty('type', 'radio');
        expect(yield screen.getByLabelText('Lowest')).toBeInTheDocument();
        expect(yield screen.getByLabelText('Medium')).toBeInTheDocument();
        expect(yield screen.getByLabelText('High')).toBeInTheDocument();
        expect(yield screen.getByLabelText('Highest')).toBeInTheDocument();
    }));
    it('should call the validators passed in props', () => {
        const validatorOne = jest.fn();
        const validatorTwo = jest.fn();
        render(React.createElement(FormWrapper, null,
            React.createElement(RadioButtonGroupField, { name: "test", options: options, validators: [validatorOne, validatorTwo] })));
        expect(validatorOne).toBeCalledTimes(1);
        expect(validatorTwo).toBeCalledTimes(1);
    });
    it('should show an error on invalid input', () => __awaiter(void 0, void 0, void 0, function* () {
        const validatorOne = jest.fn().mockReturnValue('some error');
        const validatorTwo = jest.fn();
        render(React.createElement(FormWrapper, null,
            React.createElement(RadioButtonGroupField, { name: "test", options: options, validators: [validatorOne, validatorTwo] })));
        const state = yield screen.getByTestId('test-radio-state');
        expect(screen.getByTestId('test-field-error-message')).toBeEmptyDOMElement();
        expect(validatorOne).toBeCalledTimes(1);
        fireEvent.change(state, { target: { value: 'Test' } });
        expect(validatorOne).toBeCalledTimes(2);
        expect(validatorTwo).toBeCalledTimes(0);
        expect(yield screen.getByTestId('test-field-error-message')).toHaveTextContent('some error');
    }));
    it('should show validation errors on blur if specified', () => __awaiter(void 0, void 0, void 0, function* () {
        const validatorOne = jest.fn();
        const validatorTwo = jest.fn().mockReturnValue('some error');
        render(React.createElement(FormWrapper, null,
            React.createElement(RadioButtonGroupField, { showErrorOnBlur: true, name: "test", options: options, validators: [validatorOne, validatorTwo] })));
        const state = yield screen.getByTestId('test-radio-state');
        fireEvent.change(state, { target: { value: 'Test' } });
        expect(validatorOne).toBeCalledTimes(2);
        expect(validatorTwo).toBeCalledTimes(2);
        expect(yield screen.getByTestId('test-field-error-message')).toBeEmptyDOMElement();
        fireEvent.blur(state);
        expect(yield screen.getByTestId('test-field-error-message')).toHaveTextContent('some error');
    }));
    it('should show no labels if none are passed via props', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(RadioButtonGroupField, { name: "test", options: options })));
        expect(yield screen.queryByTestId('test-field-label')).not.toBeInTheDocument();
    }));
    it('should show a label if one is passed via props', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(RadioButtonGroupField, { label: "test label", name: "test", options: options })));
        expect(yield screen.getByTestId('test-field-label')).toBeInTheDocument();
        expect(yield screen.getByTestId('test-field-label')).toHaveTextContent('test label');
    }));
    it('should show an asterisk on the label if the field is required', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(RadioButtonGroupField, { label: "test label", name: "test", options: options, required: true })));
        expect(yield screen.getByTestId('test-field-label')).toBeInTheDocument();
        expect(yield screen.getByTestId('test-field-label')).toHaveTextContent('test label *');
    }));
    it('should change the state value when clicked on a different radio button', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, { initialValues: initialValues },
            React.createElement(RadioButtonGroupField, { name: "test", options: options })));
        const state = yield screen.getByTestId('test-radio-state');
        const buttons = yield screen.getAllByTestId('test-radio-button');
        expect(state).toHaveProperty('value', 'lowest');
        expect(buttons[0]).toHaveProperty('checked', true);
        fireEvent.click(buttons[1]);
        expect(state).toHaveProperty('value', 'medium');
        expect(buttons[1]).toHaveProperty('checked', true);
    }));
    it('should disable all radio buttons when `disabled` is passed via props', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, { initialValues: initialValues },
            React.createElement(RadioButtonGroupField, { name: "test", options: options, disabled: true })));
        const state = yield screen.getByTestId('test-radio-state');
        const buttons = yield screen.getAllByTestId('test-radio-button');
        expect(state).toHaveProperty('value', 'lowest');
        expect(state).toHaveProperty('disabled', false);
        expect(buttons[0]).toHaveProperty('checked', true);
        expect(buttons[2]).toHaveProperty('disabled', true);
        fireEvent.click(buttons[2]);
        // The value shouldn't have changed since the component disallows clicks when disabled
        expect(state).toHaveProperty('value', 'lowest');
        expect(buttons[0]).toHaveProperty('checked', true);
    }));
    it('should apply the passed class name to the wrapper', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = render(React.createElement(FormWrapper, null,
            React.createElement(RadioButtonGroupField, { name: "test", options: options, className: "testClass" })));
        expect(container.querySelector('div.testClass')).toBeInTheDocument();
    }));
    xit('should trigger a change event when clicking on arrow buttons', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, { initialValues: initialValues },
            React.createElement(RadioButtonGroupField, { name: "test", options: options })));
        const state = yield screen.getByTestId('test-radio-state');
        const buttons = yield screen.getAllByTestId('test-radio-button');
        expect(state).toHaveProperty('value', 'lowest');
        expect(buttons[0]).toHaveProperty('checked', true);
        const lowestLabel = yield screen.getByLabelText('Lowest');
        const highLabel = yield screen.getByLabelText('High');
        fireEvent.focus(lowestLabel);
        fireEvent.keyDown(lowestLabel, { key: 'ArrowRight', code: 'ArrowRight' });
        fireEvent.focus(highLabel);
        fireEvent.keyDown(highLabel, { key: 'ArrowRight' });
        // The value should change since the component supports triggering changes on arrow keystrokes
        expect(state).toHaveProperty('value', 'high');
        expect(buttons[0]).toHaveProperty('checked', false);
    }));
    it('should accept any valid input html attributes and pass them over to all inputs except state', () => __awaiter(void 0, void 0, void 0, function* () {
        const title = 'Arbitrary test title';
        const onBlur = jest.fn();
        render(React.createElement(FormWrapper, null,
            React.createElement(RadioButtonGroupField, { name: "test", inputProps: {
                    onBlur,
                    title,
                }, options: options })));
        const buttons = yield screen.getAllByTestId('test-radio-button');
        fireEvent.focus(buttons[1]);
        fireEvent.blur(buttons[1]);
        expect(buttons[0]).toHaveAttribute('title', title);
        expect(onBlur).toHaveBeenCalledTimes(1);
    }));
});
//# sourceMappingURL=RadioButtonGroupField.test.js.map