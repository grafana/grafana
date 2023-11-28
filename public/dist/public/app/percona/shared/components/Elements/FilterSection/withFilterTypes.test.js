import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { RadioButtonGroupField } from 'app/percona/shared/components/Form/RadioButtonGroup';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { withFilterTypes } from './withFilterTypes';
describe('withFilterTypes', () => {
    it('should be collapsed if isOpen is not passed', () => {
        const Filters = withFilterTypes();
        render(React.createElement(Filters, { onApply: jest.fn() },
            React.createElement(TextInputField, { name: "name", label: "Name" }),
            React.createElement(RadioButtonGroupField, { options: [
                    { label: 'Foo', value: 'foo' },
                    { label: 'Bar', value: 'bar' },
                ], name: "status", disabled: true, label: "Status", defaultValue: "all" })));
        expect(screen.queryByTestId('name-text-input')).not.toBeInTheDocument();
        expect(screen.queryByTestId('status-radio-state')).not.toBeInTheDocument();
    });
    it('should render form fields when open', () => {
        const Filters = withFilterTypes();
        render(React.createElement(Filters, { isOpen: true, onApply: jest.fn() },
            React.createElement(TextInputField, { name: "name", label: "Name" }),
            React.createElement(RadioButtonGroupField, { options: [
                    { label: 'Foo', value: 'foo' },
                    { label: 'Bar', value: 'bar' },
                ], name: "status", disabled: true, label: "Status", defaultValue: "all" })));
        expect(screen.getByTestId('name-text-input')).toBeInTheDocument();
        expect(screen.getByTestId('status-radio-state')).toBeInTheDocument();
    });
    it('should attach class names to form', () => {
        const Filters = withFilterTypes();
        render(React.createElement(Filters, { isOpen: true, className: "foo-class", onApply: jest.fn() }));
        expect(screen.getByRole('form')).toHaveClass('foo-class');
    });
    it('should call onApply with form values', () => {
        const Filters = withFilterTypes();
        const onApply = jest.fn();
        render(React.createElement(Filters, { isOpen: true, onApply: onApply },
            React.createElement(TextInputField, { name: "name", label: "Name" }),
            React.createElement(TextInputField, { name: "surname", label: "Surname" })));
        fireEvent.input(screen.getByTestId('name-text-input'), { target: { value: 'John' } });
        fireEvent.input(screen.getByTestId('surname-text-input'), { target: { value: 'Doe' } });
        fireEvent.submit(screen.getByRole('form'));
        expect(onApply).toHaveBeenCalledWith({ name: 'John', surname: 'Doe' }, expect.anything(), expect.anything());
    });
});
//# sourceMappingURL=withFilterTypes.test.js.map