import React from 'react';
import { render } from '@testing-library/react';
import { Input } from '../Input/Input';
import { InlineField } from './InlineField';
import { Select } from '../Select/Select';

describe('InlineField', () => {
  it('renders the label', () => {
    const { getByText } = render(
      <InlineField label="My label">
        <Input id="my-text-input" />
      </InlineField>
    );

    expect(getByText('My label')).toBeInTheDocument();
  });

  it('renders with the id of its children', () => {
    const { getByLabelText } = render(
      <InlineField label="My label">
        <Input id="my-text-input" />
      </InlineField>
    );

    expect(getByLabelText('My label')).toBeInTheDocument();
  });

  it('renders with the inputId of its children', () => {
    const { getByLabelText } = render(
      <InlineField label="My other label">
        <Select inputId="my-select-input" onChange={() => {}} />
      </InlineField>
    );

    expect(getByLabelText('My other label')).toBeInTheDocument();
  });
});
