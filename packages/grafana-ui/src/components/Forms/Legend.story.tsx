import React from 'react';
import { Meta, Story } from '@storybook/react';

import { Legend } from '@grafana/ui';
import mdx from './Legend.mdx';

export default {
  title: 'Forms/Legend',
  component: Legend,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['description'],
    },
  },
  argTypes: {
    children: { name: 'Label' },
  },
} as Meta;

export const Basic: Story = (args) => {
  return <Legend>{args.children}</Legend>;
};
Basic.args = {
  children: 'Form section',
};
