import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { Legend } from '@grafana/ui';

import mdx from './Legend.mdx';

const meta: ComponentMeta<typeof Legend> = {
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
};

export const Basic: ComponentStory<typeof Legend> = (args) => {
  return <Legend>{args.children}</Legend>;
};
Basic.args = {
  children: 'Form section',
};

export default meta;
