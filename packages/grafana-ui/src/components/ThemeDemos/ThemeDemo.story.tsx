import { Meta, Story } from '@storybook/react';
import React from 'react';

import { EmotionPerfTest } from './EmotionPerfTest';
import { ThemeDemo as NewThemeDemoComponent } from './ThemeDemo';

const meta: Meta = {
  title: 'Docs Overview/Theme',
  component: NewThemeDemoComponent,
  decorators: [],
  parameters: {
    options: {
      showPanel: false,
    },
    docs: {},
  },
};

export const ThemeDemo: Story = () => {
  return <NewThemeDemoComponent />;
};

export const PerfTest: Story = () => {
  return <EmotionPerfTest />;
};

export default meta;
