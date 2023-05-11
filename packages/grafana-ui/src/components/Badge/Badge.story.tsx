import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { Badge } from '@grafana/ui';

import { iconOptions } from '../../utils/storybook/icons';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './Badge.mdx';

const meta: Meta<typeof Badge> = {
  title: 'Data Display/Badge',
  component: Badge,
  decorators: [withCenteredStory],
  parameters: {
    docs: { page: mdx },
  },
  argTypes: {
    icon: { options: iconOptions, control: { type: 'select' } },
    color: { control: 'select' },
    text: { control: 'text' },
  },
};

const Template: StoryFn<typeof Badge> = (args) => <Badge {...args} />;

export const Basic = Template.bind({});

Basic.args = {
  text: 'Badge label',
  color: 'blue',
  icon: 'rocket',
};

export default meta;
