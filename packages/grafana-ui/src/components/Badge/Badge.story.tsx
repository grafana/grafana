import React from 'react';
import { Story } from '@storybook/react';
import { Badge, BadgeProps } from '@grafana/ui';
import { iconOptions } from '../../utils/storybook/knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

export default {
  title: 'Data Display/Badge',
  component: Badge,
  decorators: [withCenteredStory],
  parameters: {
    docs: {},
  },
  argTypes: {
    icon: { options: iconOptions, control: { type: 'select' } },
    color: { control: 'select' },
    text: { control: 'text' },
  },
};

const Template: Story<BadgeProps> = (args) => <Badge {...args} />;

export const Basic = Template.bind({});

Basic.args = {
  text: 'Badge label',
  color: 'blue',
  icon: 'rocket',
};
