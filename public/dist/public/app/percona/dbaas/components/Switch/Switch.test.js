import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { FormWrapper } from 'app/percona/shared/helpers/utils';
import { SwitchField } from './Switch';
describe('SwitchField::', () => {
    it('should render an input element of type checkbox', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(SwitchField, { name: "test" })));
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
        expect(screen.getByTestId('test-switch')).toBeInTheDocument();
    }));
    it('should call passed validators', () => {
        const validatorOne = jest.fn();
        const validatorTwo = jest.fn();
        render(React.createElement(FormWrapper, null,
            React.createElement(SwitchField, { name: "test", validators: [validatorOne, validatorTwo] })));
        expect(validatorOne).toBeCalledTimes(1);
        expect(validatorTwo).toBeCalledTimes(1);
    });
    it('should show no labels if one is not specified', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(SwitchField, { name: "test" })));
        expect(screen.queryByTestId('test-field-label')).not.toBeInTheDocument();
    });
    it('should show a label if one is specified', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(SwitchField, { label: "test label", name: "test" })));
        expect(screen.getByTestId('test-field-label')).toBeInTheDocument();
        expect(screen.getByTestId('test-field-label')).toHaveTextContent('test label');
    });
    it('should change the state value when clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(FormWrapper, null,
            React.createElement(SwitchField, { name: "test" })));
        expect(screen.getByTestId('test-switch')).toHaveProperty('value', 'on');
        const checkbox = screen.getByRole('checkbox');
        yield waitFor(() => fireEvent.change(checkbox, { target: { value: true } }));
        expect(screen.getByTestId('test-switch')).toHaveProperty('value', 'true');
    }));
    it('should disable switch when `disabled` is passed via props', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(SwitchField, { name: "test", disabled: true })));
        expect(screen.getByRole('checkbox')).toBeDisabled();
    });
});
//# sourceMappingURL=Switch.test.js.map