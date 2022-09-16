import { render, screen } from '@testing-library/react';
import React from 'react';

import { Input } from '../Input/Input';
import { Select } from '../Select/Select';

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
    render(
      <Field label="My other label">
        <Select inputId="my-select-input" onChange={() => {}} />
      </Field>
    );

    expect(screen.getByLabelText('My other label')).toBeInTheDocument();
  });
});
