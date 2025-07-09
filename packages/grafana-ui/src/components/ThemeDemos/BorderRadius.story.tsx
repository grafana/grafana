import { Meta, StoryFn } from '@storybook/react';

import { BorderRadiusContainer } from './BorderRadius';

const meta: Meta = {
  title: 'Developers/Border radius',
  component: BorderRadiusContainer,
  decorators: [],
  parameters: {
    layout: 'centered',
  },
  args: {
    referenceBorderRadius: 20,
    referenceBorderWidth: 10,
    offset: 0,
    borderWidth: 2,
  },
  argTypes: {
    offset: {
      control: {
        min: 0,
      },
    },
    referenceBorderRadius: {
      control: {
        min: 0,
      },
    },
    referenceBorderWidth: {
      control: {
        min: 0,
      },
    },
    borderWidth: {
      control: {
        min: 0,
      },
    },
  },
};

export const OffsetBorderRadius: StoryFn<typeof BorderRadiusContainer> = (args) => {
  return <BorderRadiusContainer {...args} />;
};

export default meta;
