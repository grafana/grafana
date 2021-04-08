import React from 'react';
import { ThemeColors } from './ThemeColors';

export default {
  title: 'Docs Overview/Theme',
  component: ThemeColors,
  decorators: [],
  parameters: {
    options: {
      showPanel: false,
    },
    docs: {},
  },
};

export const OldThemeDemo = () => {
  return <ThemeColors />;
};
