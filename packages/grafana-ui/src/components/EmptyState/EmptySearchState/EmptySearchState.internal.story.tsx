import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { EmptySearchState } from './EmptySearchState';
import mdx from './EmptySearchState.mdx';

const meta: Meta<typeof EmptySearchState> = {
  title: 'General/EmptyState/EmptySearchState',
  component: EmptySearchState,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {
    children: {
      type: 'string',
    },
  },
};

export const Basic: StoryFn = (args) => {
  return <EmptySearchState {...args}>{args.children}</EmptySearchState>;
};

Basic.args = {
  children: 'Use this space to add any additional information',
};

export default meta;
