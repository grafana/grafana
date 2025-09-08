import type { Meta, StoryObj } from '@storybook/react';
import { ComponentProps } from 'react';

import { Stack } from '@grafana/ui';

import { StateBadge } from './StateBadge';
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
  render: (args: ComponentProps<typeof StateBadge>) => (
    <Stack direction="column" alignItems="flex-start">
      <StateBadge {...args} />
      <hr />
      <StateBadge type="alerting" state="normal" />
      <StateBadge type="alerting" state="pending" />
      <StateBadge type="alerting" state="firing" />
      <StateBadge type="alerting" state="recovering" />
      <StateBadge type="alerting" state="unknown" />
      <hr />
      <StateBadge type="alerting" state="firing" health="error" />
      <StateBadge type="alerting" state="firing" health="nodata" />
    </Stack>
  ),
};

export const RecordingRule: StoryObj<typeof StateBadge> = {
  render: (args: ComponentProps<typeof StateBadge>) => (
    <Stack direction="column" alignItems="flex-start">
      <StateBadge type="recording" health={'error'} state={undefined} />
      <StateBadge type="recording" health={undefined} state={undefined} />
    </Stack>
  ),
};
