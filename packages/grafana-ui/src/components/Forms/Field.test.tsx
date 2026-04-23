import { render, screen } from '@testing-library/react';

import { Combobox } from '../Combobox/Combobox';
import { MultiCombobox } from '../Combobox/MultiCombobox';
import { Input } from '../Input/Input';
import { SecretInput } from '../SecretInput';
import { MultiSelect, Select } from '../Select/Select';
import { Slider } from '../Slider/Slider';
import { Switch } from '../Switch/Switch';
import { TextArea } from '../TextArea/TextArea';

import { Checkbox } from './Checkbox';
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

  describe('Input', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <Field label="My label">
          <Input />
        </Field>
      );

      expect(screen.getByRole('textbox', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <Field label="My label" invalid error="My error">
          <Input />
        </Field>
      );

      expect(screen.getByRole('textbox', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('SecretInput', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <Field label="My label">
          <SecretInput isConfigured={false} onReset={() => {}} />
        </Field>
      );

      // can't use getByRole here as type="password" inputs don't have an implicit role
      // see https://github.com/testing-library/dom-testing-library/issues/567
      expect(screen.getByLabelText('My label')).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <Field label="My label" invalid error="My error">
          <SecretInput isConfigured={false} onReset={() => {}} />
        </Field>
      );

      // can't use getByRole here as type="password" inputs don't have an implicit role
      // see https://github.com/testing-library/dom-testing-library/issues/567
      const secretInput = screen.getByLabelText('My label');
      expect(secretInput).toBeInTheDocument();
      expect(secretInput).toHaveAccessibleDescription('My error');
    });
  });

  describe('Checkbox', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <Field label="My label">
          <Checkbox />
        </Field>
      );

      expect(screen.getByRole('checkbox', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <Field label="My label" invalid error="My error">
          <Checkbox />
        </Field>
      );

      expect(screen.getByRole('checkbox', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('Switch', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <Field label="My label">
          <Switch />
        </Field>
      );

      expect(screen.getByRole('switch', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <Field label="My label" invalid error="My error">
          <Switch />
        </Field>
      );

      expect(screen.getByRole('switch', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('Select', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <Field label="My label">
          <Select onChange={() => {}} />
        </Field>
      );

      expect(screen.getByRole('combobox', { name: 'My label' })).toBeInTheDocument();
    });
  });

  describe('MultiSelect', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <Field label="My label">
          <MultiSelect onChange={() => {}} />
        </Field>
      );

      expect(screen.getByRole('combobox', { name: 'My label' })).toBeInTheDocument();
    });
  });

  describe('Combobox', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <Field label="My label">
          <Combobox onChange={() => {}} options={[]} />
        </Field>
      );

      expect(screen.getByRole('combobox', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <Field label="My label" invalid error="My error">
          <Combobox onChange={() => {}} options={[]} />
        </Field>
      );

      expect(screen.getByRole('combobox', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('MultiCombobox', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <Field label="My label">
          <MultiCombobox onChange={() => {}} options={[]} />
        </Field>
      );

      expect(screen.getByRole('combobox', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <Field label="My label" invalid error="My error">
          <MultiCombobox onChange={() => {}} options={[]} />
        </Field>
      );

      expect(screen.getByRole('combobox', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('Slider', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <Field label="My label">
          <Slider min={0} max={10} />
        </Field>
      );

      expect(screen.getByRole('textbox', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <Field label="My label" invalid error="My error">
          <Slider min={0} max={10} />
        </Field>
      );

      expect(screen.getByRole('textbox', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('TextArea', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <Field label="My label">
          <TextArea />
        </Field>
      );

      expect(screen.getByRole('textbox', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <Field label="My label" invalid error="My error">
          <TextArea />
        </Field>
      );

      expect(screen.getByRole('textbox', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
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
