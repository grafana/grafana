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
        'className',
        'error',
        'loading',
        'htmlFor',
        'invalid',
        'horizontal',
        'onFinishChange',
        'validationMessageHorizontalOverflow',
      ],
    },
  },
  argTypes: {
    saveErrorMessage: { control: 'text' },
    label: { control: 'text' },
    required: {
      control: { type: 'boolean', options: [true, false] },
    },
    inputSuccessful: {
      control: { type: 'boolean', options: [true, false] },
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

export const Basic: Story = (args) => {
  const [inputValue, setInputValue] = useState('');
  return (
    <AutoSaveField onFinishChange={args.inputSuccessful ? getSuccess : getError} {...args}>
      {(onChange) => (
        <Input
          value={inputValue}
          onChange={(e) => {
            const value = e.currentTarget.value;
            onChange(value);
            setInputValue(e.currentTarget.value);
          }}
        />
      )}
    </AutoSaveField>
  );
};

Basic.args = {
  required: false,
  label: 'Input saving value automatically',
  inputSuccessful: false,
};

export const AllComponents: Story = (args) => {
  const [selected, setSelected] = useState('');
  const [checkBoxTest, setCheckBoxTest] = useState(false);
  const [textAreaValue, setTextAreaValue] = useState('');
  const [inputTextValue, setInputTextValue] = useState('');
  const [switchTest, setSwitchTest] = useState(false);

  return (
    <div>
      <AutoSaveField onFinishChange={args.inputSuccessful ? getSuccess : getError} label="Text as a child" {...args}>
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
      <AutoSaveField onFinishChange={args.inputSuccessful ? getSuccess : getError} label="Select as child" {...args}>
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
      <AutoSaveField
        onFinishChange={args.inputSuccessful ? getSuccess : getError}
        label="RadioButtonGroup as a child"
        {...args}
      >
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
      <AutoSaveField<Boolean>
        onFinishChange={args.inputSuccessful ? getSuccess : getError}
        label="Checkbox as a child"
        {...args}
      >
        {(onChange) => (
          <Checkbox
            label="Checkbox test"
            description="This is a checkbox input"
            name="checkbox-test"
            value={checkBoxTest}
            onChange={(e) => {
              const value = e.currentTarget.checked;
              onChange(value);
              setCheckBoxTest(value);
            }}
          />
        )}
      </AutoSaveField>
      <AutoSaveField
        onFinishChange={args.inputSuccessful ? getSuccess : getError}
        label="TextArea as a child"
        {...args}
      >
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
      <AutoSaveField<Boolean>
        onFinishChange={args.inputSuccessful ? getSuccess : getError}
        label="Switch as a child"
        {...args}
      >
        {(onChange) => (
          <Switch
            label="Switch test"
            name="switch-test"
            value={switchTest}
            onChange={(e) => {
              onChange(e.currentTarget.checked);
              setSwitchTest(e.currentTarget.checked);
            }}
          />
        )}
      </AutoSaveField>
    </div>
  );
};
AllComponents.args = {
  required: false,
  inputSuccessful: true,
};
