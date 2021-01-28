import React from 'react';
import { Story } from '@storybook/react';
import { Badge, BadgeProps } from '@grafana/ui';
import { iconOptions } from '../../utils/storybook/knobs';

export default {
  title: 'Data Display/Badge',
  component: Badge,
  decorators: [],
  parameters: {
    docs: {},
    knobs: {
      disabled: true,
    },
  },
  argTypes: {
    icon: { control: { type: 'select', options: iconOptions } },
    color: { control: 'select' },
  },
};

const Template: Story<BadgeProps> = (args) => <Badge {...args} />;

export const Basic = Template.bind({});

Basic.args = {
  text: 'Badge label',
  color: 'blue',
  icon: 'rocket',
};
