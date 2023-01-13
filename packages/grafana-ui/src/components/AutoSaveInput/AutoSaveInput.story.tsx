import { Story, Meta } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { AutoSaveInput } from './AutoSaveInput';
import mdx from './AutoSaveInput.mdx';

const meta: Meta = {
  title: 'AutoSaveInput',
  component: AutoSaveInput,
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
    customErrorMessage: { control: 'text' },
    label: { control: 'text' },
    required: {
      control: { type: 'select', options: [true, false] },
    },
  },
  args: {
    customErrorMessage: 'This is a custom error message',
    label: 'Custom label',
    required: false,
  },
};

export default meta;

const getSuccess = () => {
  return new Promise<void>((resolve) => {
    resolve();
  });
};
const getError = () => {
  return new Promise<void>((resolve, reject) => {
    reject();
  });
};

export const AutoSaveInputError: Story = (args) => (
  <AutoSaveInput
    onFinishChange={getError}
    customErrorMessage={args.customErrorMessage}
    label={args.label}
    required={args.required}
  />
);
AutoSaveInputError.args = {
  label: 'With error',
  required: false,
};

export const AutoSaveInputSuccess: Story = (args) => (
  <AutoSaveInput onFinishChange={getSuccess} label={args.label} required={args.required} />
);
AutoSaveInputSuccess.args = {
  label: 'With success',
  required: true,
};
