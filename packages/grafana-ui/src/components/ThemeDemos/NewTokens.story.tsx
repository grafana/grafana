import { Meta, Story } from '@storybook/react';
import React from 'react';

import mdx from './NewTokens.mdx';
import { CoreColorsDemo, ThemeColorsDemo } from './ThemeTokens';

const meta: Meta = {
  title: 'Docs Overview/New Theme',
  component: CoreColorsDemo,
  decorators: [],
  parameters: {
    options: {
      showPanel: false,
    },
    docs: {
      page: mdx,
    },
  },
};

export const CoreColor: Story = () => {
  return <CoreColorsDemo />;
};

export const ThemeColor: Story = () => {
  return <ThemeColorsDemo />;
};

export default meta;
