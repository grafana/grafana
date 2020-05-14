import React from 'react';
import { ThemeColors } from './ThemeColors';

export default {
  title: 'Docs Overview/ThemeColors',
  component: ThemeColors,
  decorators: [],
  parameters: {
    options: {
      showPanel: false,
    },
    docs: {},
  },
};

export const ThemeColorsDemo = () => {
  return <ThemeColors />;
};
