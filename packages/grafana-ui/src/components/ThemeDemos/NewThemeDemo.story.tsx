import React from 'react';
import { EmotionPerfTest } from './EmotionPerfTest';
import { NewThemeDemo as NewThemeDemoComponent } from './NewThemeDemo';

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

export const NewThemeDemo = () => {
  return <NewThemeDemoComponent />;
};

export const PerfTest = () => {
  return <EmotionPerfTest />;
};
