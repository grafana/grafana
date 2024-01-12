import { StoryFn, Meta } from '@storybook/react';
import React from 'react';

import { LoadingPlaceholder, LoadingPlaceholderProps } from './LoadingPlaceholder';
import mdx from './LoadingPlaceholder.mdx';

const meta: Meta<typeof LoadingPlaceholder> = {
  title: 'General/LoadingPlaceholder',
  component: LoadingPlaceholder,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {
    text: {
      control: { type: 'text' },
    },
  },
};

export const Basic: StoryFn<typeof LoadingPlaceholder> = (args: LoadingPlaceholderProps) => {
  return <LoadingPlaceholder {...args} />;
};

Basic.args = {
  text: 'Loading...',
};

export default meta;
