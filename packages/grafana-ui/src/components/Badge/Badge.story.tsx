import { Meta, StoryFn } from '@storybook/react';

import { iconOptions } from '../../utils/storybook/icons';

import { Badge } from './Badge';
import mdx from './Badge.mdx';

const meta: Meta<typeof Badge> = {
  title: 'Data Display/Badge',
  component: Badge,
  parameters: {
    docs: { page: mdx },
  },
  argTypes: {
    icon: {
      options: Object.keys(iconOptions),
      control: {
        type: 'select',
        labels: iconOptions,
      },
    },
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
