import type { Meta, StoryFn, StoryObj } from '@storybook/react';
import { type ComponentProps } from 'react';

import { Stack } from '@grafana/ui';

import { StateIcon } from './StateIcon';
import mdx from './StateIcon.mdx';

const meta: Meta<typeof StateIcon> = {
  component: StateIcon,
  title: 'Rules/StateIcon',
  decorators: [],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const StoryRenderFn: StoryFn<ComponentProps<typeof StateIcon>> = (args) => {
  return <StateIcon {...args} />;
};

export default meta;
type Story = StoryObj<typeof StateIcon>;

export const Basic: Story = {
  render: StoryRenderFn,
};

export const DistinctShapes: Story = {
  render: () => (
    <Stack direction="row" gap={2}>
      <StateIcon state="firing" distinctShapes />
      <StateIcon state="pending" distinctShapes />
      <StateIcon state="normal" isPaused distinctShapes />
      <StateIcon state="normal" distinctShapes />
    </Stack>
  ),
};
