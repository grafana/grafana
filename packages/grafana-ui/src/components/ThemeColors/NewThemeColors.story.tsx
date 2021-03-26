import React from 'react';
import { NewThemeColors } from './NewThemeColors';

export default {
  title: 'Docs Overview/NewThemeColors',
  component: NewThemeColors,
  decorators: [],
  parameters: {
    options: {
      showPanel: false,
    },
    docs: {},
  },
};

export const NewThemeColorsDemo = () => {
  return <NewThemeColors />;
};
