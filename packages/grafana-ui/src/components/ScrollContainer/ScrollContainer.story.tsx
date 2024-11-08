import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/preview-api';
import { Meta, StoryFn } from '@storybook/react';

import { ScrollContainer } from './ScrollContainer';

const meta: Meta<typeof ScrollContainer> = {
  title: 'Layout/ScrollContainer',
  component: ScrollContainer,
  parameters: {
    controls: {
      // exclude: ['onChange', 'onReset'],
    },
  },
  argTypes: {},
  args: {
    height: '600px',
    width: '400px',
  },
};

export const Basic: StoryFn<typeof ScrollContainer> = (args) => {
  return (
    <ScrollContainer {...args}>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
      magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
      consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
      Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
    </ScrollContainer>
  );
};

export default meta;
