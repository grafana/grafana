import { type Meta, type StoryFn } from '@storybook/react';

import { ThemeDemo as NewThemeDemoComponent } from './ThemeDemo';

const meta: Meta = {
  title: 'Foundations/Theme',
  component: NewThemeDemoComponent,
  decorators: [],
  tags: ['!autodocs'],
  parameters: {
    options: {
      showPanel: false,
    },
  },
};

export const ThemeDemo: StoryFn = () => {
  return <NewThemeDemoComponent />;
};

export default meta;
