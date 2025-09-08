import type { Meta, StoryObj } from '@storybook/react';

import { RecordingBadge, StateBadge } from './StateBadge';
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

export default meta;

export const AlertRule: StoryObj<typeof StateBadge> = {
  render: (args) => <StateBadge {...args} />,
};

export const RecordingRule: StoryObj<typeof RecordingBadge> = {
  render: (args) => <RecordingBadge {...args} />,
};
