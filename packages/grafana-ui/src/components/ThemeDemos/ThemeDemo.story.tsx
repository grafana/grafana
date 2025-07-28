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
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
  },
};

export const ThemeDemo: StoryFn = () => {
  return <NewThemeDemoComponent />;
};

export default meta;
