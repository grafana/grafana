import { render, screen } from '@testing-library/react';

import { Cascader } from '../Cascader/Cascader';
import { Combobox } from '../Combobox/Combobox';
import { MultiCombobox } from '../Combobox/MultiCombobox';
import { FileDropzone } from '../FileDropzone/FileDropzone';
import { FilterInput } from '../FilterInput/FilterInput';
import { Input } from '../Input/Input';
import { FieldNamePicker } from '../MatchersUI/FieldNamePicker';
import { SecretInput } from '../SecretInput';
import { SecretTextArea } from '../SecretTextArea';
import { MultiSelect, Select } from '../Select/Select';
import { Slider } from '../Slider/Slider';
import { InlineSwitch, Switch } from '../Switch/Switch';
import { TagsInput } from '../TagsInput/TagsInput';
import { TextArea } from '../TextArea/TextArea';

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

  describe('Input', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <InlineField label="My label">
          <Input />
        </InlineField>
      );

      expect(screen.getByRole('textbox', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <InlineField label="My label" invalid error="My error">
          <Input />
        </InlineField>
      );

      expect(screen.getByRole('textbox', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('SecretInput', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <InlineField label="My label">
          <SecretInput isConfigured={false} onReset={() => {}} />
        </InlineField>
      );

      // can't use getByRole here as type="password" inputs don't have an implicit role
      // see https://github.com/testing-library/dom-testing-library/issues/567
      expect(screen.getByLabelText('My label')).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <InlineField label="My label" invalid error="My error">
          <SecretInput isConfigured={false} onReset={() => {}} />
        </InlineField>
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
        <InlineField label="My label">
          <Checkbox />
        </InlineField>
      );

      expect(screen.getByRole('checkbox', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <InlineField label="My label" invalid error="My error">
          <Checkbox />
        </InlineField>
      );

      expect(screen.getByRole('checkbox', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('Switch', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <InlineField label="My label">
          <Switch />
        </InlineField>
      );

      expect(screen.getByRole('switch', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <InlineField label="My label" invalid error="My error">
          <Switch />
        </InlineField>
      );

      expect(screen.getByRole('switch', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('InlineSwitch', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <InlineField label="My label">
          <InlineSwitch />
        </InlineField>
      );

      expect(screen.getByRole('switch', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <InlineField label="My label" invalid error="My error">
          <InlineSwitch />
        </InlineField>
      );

      expect(screen.getByRole('switch', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('RadioButtonGroup', () => {
    const radioOptions = [
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' },
    ];

    it('renders the fieldset group with an accessible name from the legend', () => {
      render(
        <InlineField label="Theme">
          <RadioButtonGroup options={radioOptions} />
        </InlineField>
      );

      expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    });

    it('renders required indicator inside the legend', () => {
      render(
        <InlineField label="Theme" required>
          <RadioButtonGroup options={radioOptions} />
        </InlineField>
      );

      expect(screen.getByRole('radiogroup', { name: 'Theme *' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <InlineField label="My label" invalid error="My error">
          <RadioButtonGroup options={radioOptions} />
        </InlineField>
      );

      expect(screen.getByRole('radio', { name: 'Dark', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('Select', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <InlineField label="My label">
          <Select onChange={() => {}} />
        </InlineField>
      );

      expect(screen.getByRole('combobox', { name: 'My label' })).toBeInTheDocument();
    });
  });

  describe('MultiSelect', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <InlineField label="My label">
          <MultiSelect onChange={() => {}} />
        </InlineField>
      );

      expect(screen.getByRole('combobox', { name: 'My label' })).toBeInTheDocument();
    });
  });

  describe('Combobox', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <InlineField label="My label">
          <Combobox onChange={() => {}} options={[]} />
        </InlineField>
      );

      expect(screen.getByRole('combobox', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <InlineField label="My label" invalid error="My error">
          <Combobox onChange={() => {}} options={[]} />
        </InlineField>
      );

      expect(screen.getByRole('combobox', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('MultiCombobox', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <InlineField label="My label">
          <MultiCombobox onChange={() => {}} options={[]} />
        </InlineField>
      );

      expect(screen.getByRole('combobox', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <InlineField label="My label" invalid error="My error">
          <MultiCombobox onChange={() => {}} options={[]} />
        </InlineField>
      );

      expect(screen.getByRole('combobox', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('Slider', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <InlineField label="My label">
          <Slider min={0} max={10} />
        </InlineField>
      );

      expect(screen.getByRole('textbox', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <InlineField label="My label" invalid error="My error">
          <Slider min={0} max={10} />
        </InlineField>
      );

      expect(screen.getByRole('textbox', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('TextArea', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <InlineField label="My label">
          <TextArea />
        </InlineField>
      );

      expect(screen.getByRole('textbox', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <InlineField label="My label" invalid error="My error">
          <TextArea />
        </InlineField>
      );

      expect(screen.getByRole('textbox', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('SecretTextArea', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <InlineField label="My label">
          <SecretTextArea isConfigured={false} onReset={() => {}} />
        </InlineField>
      );

      expect(screen.getByRole('textbox', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <InlineField label="My label" invalid error="My error">
          <SecretTextArea isConfigured={true} onReset={() => {}} />
        </InlineField>
      );

      expect(screen.getByRole('textbox', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('TagsInput', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <InlineField label="My label">
          <TagsInput onChange={() => {}} />
        </InlineField>
      );

      expect(screen.getByRole('textbox', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <InlineField label="My label" invalid error="My error">
          <TagsInput onChange={() => {}} />
        </InlineField>
      );

      expect(screen.getByRole('textbox', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('FieldNamePicker', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <InlineField label="My label">
          <FieldNamePicker value="foo" onChange={() => {}} item={{ id: 'foo', name: 'Foo' }} context={{ data: [] }} />
        </InlineField>
      );

      expect(screen.getByRole('combobox', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <InlineField label="My label" invalid error="My error">
          <FieldNamePicker value="foo" onChange={() => {}} item={{ id: 'foo', name: 'Foo' }} context={{ data: [] }} />
        </InlineField>
      );

      expect(screen.getByRole('combobox', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('Cascader', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <InlineField label="My label">
          <Cascader options={[]} onSelect={() => {}} />
        </InlineField>
      );

      expect(screen.getByRole('textbox', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <InlineField label="My label" invalid error="My error">
          <Cascader options={[]} onSelect={() => {}} />
        </InlineField>
      );

      expect(screen.getByRole('textbox', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('FilterInput', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <InlineField label="My label">
          <FilterInput value="" onChange={() => {}} />
        </InlineField>
      );

      expect(screen.getByRole('textbox', { name: 'My label' })).toBeInTheDocument();
    });

    it('associates with the field error correctly when no id is set', () => {
      render(
        <InlineField label="My label" invalid error="My error">
          <FilterInput value="" onChange={() => {}} />
        </InlineField>
      );

      expect(screen.getByRole('textbox', { name: 'My label', description: 'My error' })).toBeInTheDocument();
    });
  });

  describe('FileDropzone', () => {
    it('associates with the field label correctly when no id is set', () => {
      render(
        <InlineField label="My label">
          <FileDropzone />
        </InlineField>
      );

      expect(screen.getByLabelText('My label')).toBeInTheDocument();
    });
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
