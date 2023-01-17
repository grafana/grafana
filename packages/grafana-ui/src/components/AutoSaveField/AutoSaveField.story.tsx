import { Story, Meta } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Input } from '../Input/Input';

import { AutoSaveField } from './AutoSaveField';
import mdx from './AutoSaveField.mdx';

const meta: Meta = {
  title: 'AutoSaveField',
  component: AutoSaveField,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['prefix', 'width', 'loading', 'suffix', 'addonBefore', 'addonAfter', 'onFinishChange', 'invalid'],
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
    label: 'Custom label',
    required: false,
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

export const AutoSaveFieldError: Story = (args) => (
  <AutoSaveField onFinishChange={getError} {...args}>
    <Input />
  </AutoSaveField>
);
AutoSaveFieldError.args = {
  label: 'With error',
  required: false,
};

export const AutoSaveFieldSuccess: Story = (args) => (
  <AutoSaveField onFinishChange={getSuccess} {...args}>
    <Input />
  </AutoSaveField>
);
AutoSaveFieldSuccess.args = {
  label: 'With success',
  required: true,
};
