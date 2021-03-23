import React from 'react';
import { Story } from '@storybook/react';

import { Legend } from '@grafana/ui';
import mdx from './Legend.mdx';
import { NOOP_CONTROL } from '../../utils/storybook/noopControl';

export default {
  title: 'Forms/Legend',
  component: Legend,
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disable: true,
    },
  },
  argTypes: {
    children: { name: 'Label' },
    description: NOOP_CONTROL,
  },
};

export const Basic: Story = (args) => {
  return <Legend>{args.children}</Legend>;
};
Basic.args = {
  children: 'Form section',
};
