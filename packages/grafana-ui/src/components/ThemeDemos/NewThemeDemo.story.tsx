import React from 'react';
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
