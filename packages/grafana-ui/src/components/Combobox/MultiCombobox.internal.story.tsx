import type { Meta, StoryObj } from '@storybook/react';

import { MultiCombobox } from './MultiCombobox';
import mdx from './MultiCombobox.mdx';

const meta: Meta<typeof MultiCombobox> = {
  title: 'Forms/MultiCombobox',
  component: MultiCombobox,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export default meta;

type Story = StoryObj<typeof MultiCombobox>;

export const Basic: Story = {
  args: {
    options: [
      { label: 'Option 1', value: 'option1' },
      { label: 'Option 2', value: 'option2' },
      { label: 'Option 3', value: 'option3' },
    ],
    placeholder: 'Select multiple options...',
  },
};
