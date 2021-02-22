import { Story } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
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
    // initialValue: { control: { type: 'select', options: ['none', '1', '2', '3', '4', '5'] } },
    // options: { control: 'object' },
    // className: NOOP_CONTROL,
    // value: NOOP_CONTROL,
    // fieldNames: NOOP_CONTROL,
  },
};

export const simple: Story<CascaderProps> = (args) => (
  <Cascader separator={args.separator} options={args.options} onSelect={(val) => console.log(val)} />
);
simple.args = {
  separator: '',
};
export const withInitialValue: Story<CascaderProps> = (args) => (
  <Cascader options={args.options} initialValue="2" onSelect={(val) => console.log(val)} />
);

export const withCustomValue = () => {
  const onCreateLabel = text('Custom value creation label', 'Create new value: ');
  return (
    <Cascader
      options={options}
      allowCustomValue
      formatCreateLabel={(val) => onCreateLabel + val}
      initialValue="Custom Initial Value"
      onSelect={(val) => console.log(val)}
    />
  );
};
