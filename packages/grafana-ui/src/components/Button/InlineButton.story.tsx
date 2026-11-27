import { type Meta, type StoryObj } from '@storybook/react';
import { action } from 'storybook/actions';

import { InlineButton } from './InlineButton';
import mdx from './InlineButton.mdx';

const meta: Meta<typeof InlineButton> = {
  title: 'Inputs/InlineButton',
  component: InlineButton,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  args: {
    children: 'Show details',
    onClick: action('clicked button'),
  },
};

export default meta;
type Story = StoryObj<typeof InlineButton>;

export const Inline: Story = {
  render: (args) => (
    <p>
      No integrations are connected. <InlineButton {...args} />.
    </p>
  ),
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: (args) => (
    <p>
      This action is currently unavailable. <InlineButton {...args} />.
    </p>
  ),
};
