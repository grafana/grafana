import { render, screen } from '@testing-library/react';

import { Combobox } from '../Combobox/Combobox';
import { Input } from '../Input/Input';
import { InlineSwitch, Switch } from '../Switch/Switch';

import { Checkbox } from './Checkbox';
import { InlineField } from './InlineField';
import { RadioButtonGroup } from './RadioButtonGroup/RadioButtonGroup';

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

  it('associates the label with an Input when no id is set', () => {
    render(
      <InlineField label="My label">
        <Input />
      </InlineField>
    );

    expect(screen.getByRole('textbox', { name: 'My label' })).toBeInTheDocument();
  });

  it('associates the label with a Checkbox when no id is set', () => {
    render(
      <InlineField label="My label">
        <Checkbox />
      </InlineField>
    );

    expect(screen.getByRole('checkbox', { name: 'My label' })).toBeInTheDocument();
  });

  it('associates the label with a Switch when no id is set', () => {
    render(
      <InlineField label="My label">
        <Switch />
      </InlineField>
    );

    expect(screen.getByRole('switch', { name: 'My label' })).toBeInTheDocument();
  });

  it('associates the label with an InlineSwitch when no id is set', () => {
    render(
      <InlineField label="My label">
        <InlineSwitch />
      </InlineField>
    );

    expect(screen.getByRole('switch', { name: 'My label' })).toBeInTheDocument();
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

  describe('fieldset rendering for RadioButtonGroup', () => {
    const radioOptions = [
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' },
    ];

    it('renders the radiogroup with an accessible name via aria-labelledby', () => {
      render(
        <InlineField label="Theme">
          <RadioButtonGroup options={radioOptions} />
        </InlineField>
      );

      expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    });

    it('renders required indicator in the label', () => {
      render(
        <InlineField label="Theme" required>
          <RadioButtonGroup options={radioOptions} />
        </InlineField>
      );

      expect(screen.getByRole('radiogroup', { name: 'Theme *' })).toBeInTheDocument();
    });
  });
});
