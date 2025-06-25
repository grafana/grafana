import { render, screen } from '@testing-library/react';

import { Combobox } from '../Combobox/Combobox';
import { Input } from '../Input/Input';

import { Field } from './Field';

describe('Field', () => {
  it('renders the label', () => {
    render(
      <Field label="My label">
        <Input id="my-text-input" />
      </Field>
    );

    expect(screen.getByText('My label')).toBeInTheDocument();
  });

  it('renders with the id of its children', () => {
    render(
      <Field label="My label">
        <Input id="my-text-input" />
      </Field>
    );

    expect(screen.getByLabelText('My label')).toBeInTheDocument();
  });

  it('renders with the inputId of its children', () => {
    const comboboxOptions = [
      { label: 'Option 1', value: 'option-1' },
      { label: 'Option 2', value: 'option-2' },
    ];
    render(
      <Field label="My other label">
        <Combobox id="my-select-input" options={comboboxOptions} onChange={() => {}} />
      </Field>
    );

    expect(screen.getByLabelText('My other label')).toBeInTheDocument();
  });
});
