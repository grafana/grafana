import type { Meta, StoryFn, StoryObj } from '@storybook/react';
import { ComponentProps } from 'react';

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
