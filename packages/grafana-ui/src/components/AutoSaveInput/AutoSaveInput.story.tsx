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
      exclude: ['prefix', 'width', 'loading', 'suffix', 'addonBefore', 'addonAfter'],
    },
  },
  argTypes: {},
  args: {
    showError: false,
    invalid: false,
  },
};

export default meta;
// const isError = meta?.args?.showError;
const getSuccess = () => {
  return new Promise<void>((resolve) => {
    resolve();
  });
};
const getError = () => {
  return new Promise<void>((reject) => {
    reject();
  });
};
export const AutoSaveInputError: Story = ({ ...args }) => <AutoSaveInput onFinishChange={getError} {...args} />;
AutoSaveInputError.args = {
  showError: true,
  invalid: true,
  onFinishChange: getError,
};
export const AutoSaveInputSuccess: Story = ({ ...args }) => <AutoSaveInput onFinishChange={getSuccess} {...args} />;
AutoSaveInputError.args = {
  showError: false,
  invalid: false,
  onFinishChange: getSuccess,
};
