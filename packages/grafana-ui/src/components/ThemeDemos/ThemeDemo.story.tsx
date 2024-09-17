import { Meta, StoryFn } from '@storybook/react';

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

export const ThemeDemo: StoryFn = () => {
  return <NewThemeDemoComponent />;
};

export const PerfTest: StoryFn = () => {
  return <EmotionPerfTest />;
};

export default meta;
