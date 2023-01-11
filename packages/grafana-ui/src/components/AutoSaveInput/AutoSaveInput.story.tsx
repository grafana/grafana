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
  },
  args: {
    customErrorMessage: 'This is a custom error message',
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
  <AutoSaveInput onFinishChange={getError} customErrorMessage={args.customErrorMessage} />
);

export const AutoSaveInputSuccess: Story = () => <AutoSaveInput onFinishChange={getSuccess} />;
