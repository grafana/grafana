import React from 'react';
import { render } from '@testing-library/react';
import { Input } from '../Input/Input';
import { Field } from './Field';
import { Select } from '../Select/Select';

describe('Field', () => {
  it('renders the label', () => {
    const { getByText } = render(
      <Field label="My label">
        <Input id="my-text-input" />
      </Field>
    );

    expect(getByText('My label')).toBeInTheDocument();
  });

  it('renders with the id of its children', () => {
    const { getByLabelText } = render(
      <Field label="My label">
        <Input id="my-text-input" />
      </Field>
    );

    expect(getByLabelText('My label')).toBeInTheDocument();
  });

  it('renders with the inputId of its children', () => {
    const { getByLabelText } = render(
      <Field label="My other label">
        <Select inputId="my-select-input" onChange={() => {}} />
      </Field>
    );

    expect(getByLabelText('My other label')).toBeInTheDocument();
  });
});
