import type { Meta, StoryFn, StoryObj } from '@storybook/react';

import { StateBadge, StateBadgeProps } from './StateBadge';
import mdx from './StateBadge.mdx';

const meta: Meta<typeof StateBadge> = {
  component: StateBadge,
  title: 'StateBadge',
  decorators: [],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const StoryRenderFn: StoryFn<StateBadgeProps> = (args) => {
  return <StateBadge {...args} />;
};

export default meta;
type Story = StoryObj<typeof StateBadge>;

export const Basic: Story = {
  render: StoryRenderFn,
};
