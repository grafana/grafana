import { Story } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { NOOP_CONTROL } from '../../../.storybook/preview';
import { Cascader } from '@grafana/ui';
import { CascaderProps } from './Cascader';
import mdx from './Cascader.mdx';
import React from 'react';

export default {
  title: 'Forms/Cascader',
  component: Cascader,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disabled: true,
    },
  },
  args: {
    onSelect: (val: string) => console.log(val),
    options: [
      {
        label: 'First',
        value: '1',
        items: [
          {
            label: 'Second',
            value: '2',
          },
          {
            label: 'Third',
            value: '3',
          },
          {
            label: 'Fourth',
            value: '4',
          },
        ],
      },
      {
        label: 'FirstFirst',
        value: '5',
      },
    ],
  },
  argTypes: {
    width: { control: { type: 'range', min: 0, max: 70 } },
    placeholder: NOOP_CONTROL,
    initialValue: NOOP_CONTROL,
    changeOnSelect: NOOP_CONTROL,
  },
};

const Template: Story<CascaderProps> = (args) => <Cascader {...args} />;

export const Simple = Template.bind({});
Simple.args = {
  separator: '',
};
export const WithInitialValue = Template.bind({});
WithInitialValue.args = {
  initialValue: '3',
};

export const WithCustomValue = Template.bind({});
WithCustomValue.args = {
  initialValue: 'Custom Initial Value',
  allowCustomValue: true,
  formatCreateLabel: (val) => 'Custom Label' + val,
};
