import { render, screen } from '@testing-library/react';

import { Combobox } from '../Combobox/Combobox';
import { Input } from '../Input/Input';

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
    const comboboxOptions = [
      { label: 'Option 1', value: '1' },
      { label: 'Option 2', value: '2' },
    ];
    render(
      <InlineField label="My other label">
        <Combobox id="my-select-input" options={comboboxOptions} onChange={() => {}} />
      </InlineField>
    );

    expect(screen.getByLabelText('My other label')).toBeInTheDocument();
  });
});
