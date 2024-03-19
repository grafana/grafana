import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { EmptyState } from './EmptyState';
import mdx from './EmptyState.mdx';

const meta: Meta<typeof EmptyState> = {
  title: 'General/EmptyState',
  component: EmptyState,
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

export const Basic: StoryFn<typeof EmptyState> = (args) => {
  return <EmptyState {...args}>{args.children}</EmptyState>;
};

Basic.args = {
  children: 'Use this space to add any additional information',
  message: 'No dashboards created yet',
};

export default meta;
