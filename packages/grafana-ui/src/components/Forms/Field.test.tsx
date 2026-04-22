import { render, screen } from '@testing-library/react';

import { Combobox } from '../Combobox/Combobox';
import { Input } from '../Input/Input';

import { Field } from './Field';
import { RadioButtonGroup } from './RadioButtonGroup/RadioButtonGroup';

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

  it('associates the label with an Input when no id is set', () => {
    render(
      <Field label="My label">
        <Input />
      </Field>
    );

    expect(screen.getByRole('textbox', { name: 'My label' })).toBeInTheDocument();
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

  describe('fieldset/legend rendering for group controls', () => {
    const radioOptions = [
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' },
    ];

    it('renders the fieldset group with an accessible name from the legend', () => {
      render(
        <Field label="Theme">
          <RadioButtonGroup options={radioOptions} />
        </Field>
      );

      expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    });

    it('renders required indicator inside the legend', () => {
      render(
        <Field label="Theme" required>
          <RadioButtonGroup options={radioOptions} />
        </Field>
      );

      expect(screen.getByRole('group', { name: 'Theme *' })).toBeInTheDocument();
    });
  });
});
