import { Meta, StoryFn } from '@storybook/react';

import { Legend } from './Legend';
import mdx from './Legend.mdx';

const meta: Meta<typeof Legend> = {
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

export const Basic: StoryFn<typeof Legend> = (args) => {
  return <Legend>{args.children}</Legend>;
};
Basic.args = {
  children: 'Form section',
};

export default meta;
