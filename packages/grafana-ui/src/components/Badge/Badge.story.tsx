import React from 'react';
import { Story, Meta } from '@storybook/react';
import { Badge, BadgeProps } from '@grafana/ui';
import { iconOptions } from '../../utils/storybook/knobs';

export default {
  title: 'Data Display/Badge',
  component: Badge,
  decorators: [(story) => <div>{story()}</div>],
  parameters: {
    docs: {},
  },
  argTypes: {
    icon: { options: iconOptions, control: { type: 'select' } },
    color: { control: 'select' },
    text: { control: 'text' },
  },
} as Meta;

const Template: Story<BadgeProps> = (args) => <Badge {...args} />;

export const Basic = Template.bind({});

Basic.args = {
  text: 'Badge label',
  color: 'blue',
  icon: 'rocket',
};
