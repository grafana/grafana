import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Form } from 'react-final-form';
import { MultiCheckboxField } from './MultiCheckboxField';
const optionsStub = [
    { name: 'v1.0', label: '1.0', value: false },
    { name: 'v2.2', label: '2.2', value: true },
    { name: 'v4.2', label: '4.2', value: false },
    { name: 'v5.3.1', label: '5.3.1', value: false },
    { name: 'v7.0', label: '7.0', value: true },
];
describe('MultiCheckboxField', () => {
    it('renders correct options', () => {
        render(React.createElement(Form, { onSubmit: jest.fn(), render: () => React.createElement(MultiCheckboxField, { name: "test", initialOptions: optionsStub }) }));
        const optionsWrapper = screen.getByTestId('test-options');
        expect(optionsWrapper.children.length).toBe(optionsStub.length);
        expect(screen.getByTestId('v1.0-option').textContent).toBe('1.0');
        expect(screen.getByTestId('v5.3.1-option').textContent).toBe('5.3.1');
    });
    it('renders recommended option', () => {
        render(React.createElement(Form, { onSubmit: jest.fn(), render: () => (React.createElement(MultiCheckboxField, { name: "test", initialOptions: optionsStub, recommendedOptions: [optionsStub[1]], recommendedLabel: "Recommended" })) }));
        expect(screen.getByTestId('v2.2-option').textContent).toContain('Recommended');
    });
    it('submits correct values', () => {
        const onSubmit = jest.fn();
        render(React.createElement(Form, { onSubmit: onSubmit, render: ({ handleSubmit }) => (React.createElement("form", { onSubmit: handleSubmit, "data-testid": "test-form" },
                React.createElement(MultiCheckboxField, { name: "test", initialOptions: optionsStub }))) }));
        const form = screen.getByTestId('test-form');
        fireEvent.submit(form);
        expect(onSubmit).toHaveBeenCalledWith({ test: optionsStub }, expect.anything(), expect.anything());
    });
});
//# sourceMappingURL=MultiCheckboxField.test.js.map