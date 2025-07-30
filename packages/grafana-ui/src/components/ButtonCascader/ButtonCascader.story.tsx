import { StoryFn, Meta } from '@storybook/react';

import { ButtonCascader } from './ButtonCascader';

const meta: Meta<typeof ButtonCascader> = {
  title: 'Inputs/ButtonCascader',
  component: ButtonCascader,
  parameters: {
    controls: {
      exclude: ['className', 'value', 'fieldNames', 'loadData', 'onChange', 'onPopupVisibleChange'],
    },
  },
  args: {
    disabled: false,
    children: 'Click me!',
    options: [
      {
        label: 'A',
        value: 'A',
        children: [
          { label: 'B', value: 'B' },
          { label: 'C', value: 'C' },
        ],
      },
      { label: 'D', value: 'D' },
    ],
  },
  argTypes: {
    icon: { control: { type: 'select', options: ['plus', 'minus', 'table'] } },
    options: { control: 'object' },
  },
};

const Template: StoryFn<typeof ButtonCascader> = ({ children, ...args }) => {
  return <ButtonCascader {...args}>{children}</ButtonCascader>;
};

export const simple = Template.bind({});

export const withIcon = Template.bind({});
withIcon.args = {
  icon: 'plus',
};

export default meta;
