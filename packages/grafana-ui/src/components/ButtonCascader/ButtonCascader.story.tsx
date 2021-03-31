import React from 'react';
import { Story } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ButtonCascader } from '@grafana/ui';
import { NOOP_CONTROL } from '../../utils/storybook/noopControl';
import { ButtonCascaderProps } from './ButtonCascader';

export default {
  title: 'Forms/Cascader/ButtonCascader',
  component: ButtonCascader,
  decorators: [withCenteredStory],
  parameters: {
    knobs: {
      disable: true,
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
    className: NOOP_CONTROL,
    value: NOOP_CONTROL,
    fieldNames: NOOP_CONTROL,
  },
};

const Template: Story<ButtonCascaderProps> = ({ children, ...args }) => {
  return <ButtonCascader {...args}>{children}</ButtonCascader>;
};

export const simple = Template.bind({});

export const withIcon = Template.bind({});
withIcon.args = {
  icon: 'plus',
};
