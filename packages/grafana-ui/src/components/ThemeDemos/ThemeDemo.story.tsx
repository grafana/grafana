import React from 'react';

import { EmotionPerfTest } from './EmotionPerfTest';
import { ThemeDemo as NewThemeDemoComponent } from './ThemeDemo';

export default {
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

export const ThemeDemo = () => {
  return <NewThemeDemoComponent />;
};

export const PerfTest = () => {
  return <EmotionPerfTest />;
};
