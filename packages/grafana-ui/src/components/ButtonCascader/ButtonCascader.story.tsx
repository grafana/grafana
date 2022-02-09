import React from 'react';
import { Story, Meta } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ButtonCascader } from '@grafana/ui';
import { ButtonCascaderProps } from './ButtonCascader';

export default {
  title: 'Forms/Cascader/ButtonCascader',
  component: ButtonCascader,
  decorators: [withCenteredStory],
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
} as Meta;

const Template: Story<ButtonCascaderProps> = ({ children, ...args }) => {
  return <ButtonCascader {...args}>{children}</ButtonCascader>;
};

export const simple = Template.bind({});

export const withIcon = Template.bind({});
withIcon.args = {
  icon: 'plus',
};
