import { Story, Meta } from '@storybook/react';
import React, { useState } from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Checkbox } from '../Forms/Checkbox';
import { RadioButtonGroup } from '../Forms/RadioButtonGroup/RadioButtonGroup';
import { Input } from '../Input/Input';
import { Select } from '../Select/Select';
import { Switch } from '../Switch/Switch';
import { TextArea } from '../TextArea/TextArea';

import { AutoSaveField } from './AutoSaveField';
import mdx from './AutoSaveField.mdx';

const meta: Meta = {
  title: 'Forms/AutoSaveField',
  component: AutoSaveField,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    options: {
      storySort: {
        order: ['Basic', 'AllComponentsSuccess', 'AllComponentsError'],
      },
    },
    controls: {
      exclude: [
        'prefix',
        'width',
        'loading',
        'suffix',
        'addonBefore',
        'addonAfter',
        'onFinishChange',
        'invalid',
        'description',
        'horizontal',
        'validationMessageHorizontalOverflow',
        'htmlFor',
        'error',
        'className',
      ],
    },
  },
  argTypes: {
    saveErrorMessage: { control: 'text' },
    label: { control: 'text' },
    required: {
      control: { type: 'select', options: [true, false] },
    },
  },
  args: {
    saveErrorMessage: 'This is a custom error message',
    required: false,
    description: 'This input has an auto-save behaviour',
  },
};

export default meta;

const getSuccess = () => {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 1000);
  });
};
const getError = () => {
  return new Promise<void>((resolve, reject) => {
    reject();
  });
};
const themeOptions = [
  { value: '', label: 'Default' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
];
enum ThemeSwitchOption {
  Light = 'light',
  Dark = 'dark',
}

export const Basic: Story = (args) => {
  const [inputSuccessValue, setInputSuccessValue] = useState('');
  const [inputErrorValue, setInputErrorValue] = useState('');
  return (
    <div>
      <AutoSaveField onFinishChange={getSuccess} label="Input saving value successfully" {...args}>
        {(onChange) => (
          <Input
            value={inputSuccessValue}
            onChange={(e) => {
              const value = e.currentTarget.value;
              onChange(value);
              setInputSuccessValue(e.currentTarget.value);
            }}
          />
        )}
      </AutoSaveField>
      <AutoSaveField onFinishChange={getError} label="Input with an error when saving" {...args}>
        {(onChange) => (
          <Input
            value={inputErrorValue}
            onChange={(e) => {
              const value = e.currentTarget.value;
              onChange(value);
              setInputErrorValue(e.currentTarget.value);
            }}
          />
        )}
      </AutoSaveField>
    </div>
  );
};

export const AllComponentsError: Story = (args) => {
  const [selected, setSelected] = useState('');
  const [checkBoxTest, setCheckBoxTest] = useState(false);
  const [textAreaValue, setTextAreaValue] = useState('');
  const [inputTextValue, setInputTextValue] = useState('');
  const [switchTest, setSwitchTest] = useState(false);

  return (
    <div>
      <AutoSaveField onFinishChange={getError} label="Text as a child" {...args}>
        {(onChange) => (
          <Input
            value={inputTextValue}
            onChange={(e) => {
              const value = e.currentTarget.value;
              onChange(value);
              setInputTextValue(e.currentTarget.value);
            }}
          />
        )}
      </AutoSaveField>
      <AutoSaveField onFinishChange={getError} label="Select as child" {...args}>
        {(onChange) => (
          <Select
            options={themeOptions}
            value={args.weekPickerValue}
            onChange={(v) => {
              onChange(v.value);
            }}
          />
        )}
      </AutoSaveField>
      <AutoSaveField onFinishChange={getError} label="RadioButtonGroup as a child" {...args}>
        {(onChange) => (
          <RadioButtonGroup
            options={themeOptions}
            value={selected}
            onChange={(themeOption) => {
              setSelected(themeOption);
              onChange(themeOption);
            }}
          />
        )}
      </AutoSaveField>
      <AutoSaveField onFinishChange={getError} label="Checkbox as a child" {...args}>
        {(onChange) => (
          <Checkbox
            label="Checkbox test"
            description="This should trigger an error message"
            name="checkbox-test"
            value={checkBoxTest}
            onChange={(e) => {
              const value = e.currentTarget.checked.toString();
              onChange(value);
              setCheckBoxTest(e.currentTarget.checked);
            }}
          />
        )}
      </AutoSaveField>
      <AutoSaveField onFinishChange={getError} label="TextArea as a child" {...args}>
        {(onChange) => (
          <TextArea
            value={textAreaValue}
            onChange={(e) => {
              const value = e.currentTarget.value;
              onChange(value);
              setTextAreaValue(e.currentTarget.value);
            }}
          />
        )}
      </AutoSaveField>
      <AutoSaveField onFinishChange={getError} label="Switch as a child" {...args}>
        {(onChange) => (
          <Switch
            label="Switch test"
            name="switch-test"
            value={switchTest}
            onChange={(e) => {
              const value = e.currentTarget.checked ? ThemeSwitchOption.Dark : ThemeSwitchOption.Light;
              onChange(value);
              setSwitchTest(e.currentTarget.checked);
            }}
          />
        )}
      </AutoSaveField>
    </div>
  );
};
AllComponentsError.args = {
  required: false,
};

export const AllComponentsSuccess: Story = (args) => {
  const [selected, setSelected] = useState('');
  const [checkBoxTest, setCheckBoxTest] = useState(false);
  const [textAreaValue, setTextAreaValue] = useState('');
  const [inputTextValue, setInputTextValue] = useState('');
  const [switchTest, setSwitchTest] = useState(false);

  return (
    <div>
      <AutoSaveField onFinishChange={getSuccess} label="Text as a child" {...args}>
        {(onChange) => (
          <Input
            value={inputTextValue}
            onChange={(e) => {
              const value = e.currentTarget.value;
              onChange(value);
              setInputTextValue(e.currentTarget.value);
            }}
          />
        )}
      </AutoSaveField>
      <AutoSaveField onFinishChange={getSuccess} label="Select as child" {...args}>
        {(onChange) => (
          <Select
            options={themeOptions}
            value={args.weekPickerValue}
            onChange={(v) => {
              onChange(v.value);
            }}
          />
        )}
      </AutoSaveField>
      <AutoSaveField onFinishChange={getSuccess} label="RadioButtonGroup as a child" {...args}>
        {(onChange) => (
          <RadioButtonGroup
            options={themeOptions}
            value={selected}
            onChange={(themeOption) => {
              setSelected(themeOption);
              onChange(themeOption);
            }}
          />
        )}
      </AutoSaveField>
      <AutoSaveField onFinishChange={getSuccess} label="Checkbox as a child" {...args}>
        {(onChange) => (
          <Checkbox
            label="Checkbox test"
            description="This should show the 'Saved!' toast"
            name="checkbox-test"
            value={checkBoxTest}
            onChange={(e) => {
              const value = e.currentTarget.checked.toString();
              onChange(value);
              setCheckBoxTest(e.currentTarget.checked);
            }}
          />
        )}
      </AutoSaveField>
      <AutoSaveField onFinishChange={getSuccess} label="TextArea as a child" {...args}>
        {(onChange) => (
          <TextArea
            value={textAreaValue}
            onChange={(e) => {
              const value = e.currentTarget.value;
              onChange(value);
              setTextAreaValue(e.currentTarget.value);
            }}
          />
        )}
      </AutoSaveField>
      <AutoSaveField onFinishChange={getSuccess} label="Switch as a child" {...args}>
        {(onChange) => (
          <Switch
            label="Switch test"
            name="switch-test"
            value={switchTest}
            onChange={(e) => {
              const value = e.currentTarget.checked ? ThemeSwitchOption.Dark : ThemeSwitchOption.Light;
              onChange(value);
              setSwitchTest(e.currentTarget.checked);
            }}
          />
        )}
      </AutoSaveField>
    </div>
  );
};
AllComponentsSuccess.args = {
  required: true,
};
