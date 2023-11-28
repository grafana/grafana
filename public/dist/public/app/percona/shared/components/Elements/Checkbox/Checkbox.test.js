import { __awaiter } from "tslib";
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { dataQa, FormWrapper } from 'app/percona/shared/helpers/utils';
import { requiredTrue } from '../../../helpers/validatorsForm';
import { CheckboxField } from './CheckboxField';
const checkboxLabel = 'Checkbox label';
describe('CheckboxField::', () => {
    it('should render an input element of type checkbox', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(CheckboxField, { name: "test", label: "checkbox" })));
        // We can use either method: `toBeInTheDocument` or `toBeTruthy`
        expect(screen.getByRole('checkbox', { name: /checkbox/i })).toBeInTheDocument();
        expect(screen.getByTestId('test-checkbox-input')).toBeTruthy();
    });
    it('should call passed validators', () => {
        const validatorOne = jest.fn();
        const validatorTwo = jest.fn();
        render(React.createElement(FormWrapper, null,
            React.createElement(CheckboxField, { name: "test", validators: [validatorOne, validatorTwo] })));
        expect(validatorOne).toBeCalledTimes(1);
        expect(validatorTwo).toBeCalledTimes(1);
    });
    it('should show an error on invalid status', () => __awaiter(void 0, void 0, void 0, function* () {
        const validatorOne = jest.fn().mockReturnValue('some error');
        const validatorTwo = jest.fn();
        render(React.createElement(FormWrapper, null,
            React.createElement(CheckboxField, { name: "test", label: "checkbox", validators: [validatorOne, validatorTwo] })));
        const checkbox = yield screen.getByRole('checkbox', { name: /checkbox/i });
        expect(screen.queryByText('some error')).not.toBeInTheDocument();
        expect(validatorOne).toBeCalledTimes(1);
        userEvent.click(checkbox);
        // In this case we need to fire `blur`, otherwise the error will not show up
        fireEvent.blur(checkbox);
        expect(validatorOne).toBeCalledTimes(1);
        expect(validatorTwo).toBeCalledTimes(0);
        expect(screen.getByText('some error')).toBeInTheDocument();
    }));
    it('should show no labels if one is not specified', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(CheckboxField, { name: "test" })));
        expect(screen.queryByTestId(dataQa('test-field-label'))).not.toBeInTheDocument();
    });
    it('should show a label if one is specified', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(CheckboxField, { label: "test label", name: "test" })));
        expect(screen.getByTestId('test-field-label')).toBeInTheDocument();
        expect(screen.getByText('test label')).toBeInTheDocument();
    });
    it('should accept any valid input html attributes and pass them over to the input tag', () => __awaiter(void 0, void 0, void 0, function* () {
        const title = 'Titolo di soggiorno';
        const onChange = jest.fn();
        render(React.createElement(FormWrapper, null,
            React.createElement(CheckboxField, { name: "test", label: checkboxLabel, validators: [requiredTrue], inputProps: {
                    autoComplete: 'off',
                    onChange,
                    title,
                } })));
        const checkbox = yield screen.findByTestId('test-checkbox-input');
        expect(checkbox.getAttribute('autocomplete')).toEqual('off');
        fireEvent.click(checkbox);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(checkbox.getAttribute('title')).toEqual(title);
    }));
});
//# sourceMappingURL=Checkbox.test.js.map