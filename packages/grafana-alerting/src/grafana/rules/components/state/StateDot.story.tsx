import type { Meta, StoryFn, StoryObj } from '@storybook/react';
import { ComponentProps } from 'react';

import { StateDot } from './StateDot';
import mdx from './StateDot.mdx';

const meta: Meta<typeof StateDot> = {
  component: StateDot,
  title: 'StateDot',
  decorators: [],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const StoryRenderFn: StoryFn<ComponentProps<typeof StateDot>> = (args) => {
  return <StateDot {...args} />;
};

export default meta;
type Story = StoryObj<typeof StateDot>;

export const Basic: Story = {
  render: StoryRenderFn,
};
