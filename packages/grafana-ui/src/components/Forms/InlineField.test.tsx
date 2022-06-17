import { render, screen } from '@testing-library/react';
import React from 'react';

import { Input } from '../Input/Input';
import { Select } from '../Select/Select';

import { InlineField } from './InlineField';

describe('InlineField', () => {
  it('renders the label', () => {
    render(
      <InlineField label="My label">
        <Input id="my-text-input" />
      </InlineField>
    );

    expect(screen.getByText('My label')).toBeInTheDocument();
  });

  it('renders with the id of its children', () => {
    render(
      <InlineField label="My label">
        <Input id="my-text-input" />
      </InlineField>
    );

    expect(screen.getByLabelText('My label')).toBeInTheDocument();
  });

  it('renders with the inputId of its children', () => {
    render(
      <InlineField label="My other label">
        <Select inputId="my-select-input" onChange={() => {}} />
      </InlineField>
    );

    expect(screen.getByLabelText('My other label')).toBeInTheDocument();
  });
});
