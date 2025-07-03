import { Meta, StoryFn } from '@storybook/react';

import { ThemeDemo as NewThemeDemoComponent } from './ThemeDemo';

const meta: Meta = {
  title: 'Foundations/Theme',
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

export default meta;
