import { Meta, Story } from '@storybook/react';
import React from 'react';

import { SelectableValue } from '@grafana/data';

import { RadioButtonList } from './RadioButtonList';

const defaultOptions: Array<SelectableValue<string>> = [
  { label: 'Option 1', value: 'opt-1' },
  { label: 'Option 2', value: 'opt-2' },
  { label: 'Option 3', value: 'opt-3' },
  { label: 'Option 4', value: 'opt-4' },
  { label: 'Option 5', value: 'opt-5' },
];

export default {
  title: 'Forms/RadioButtonList',
  component: RadioButtonList,
  argTypes: {
    value: {
      options: defaultOptions.map((x) => x.value!),
    },
    disabledOptions: {
      control: 'multi-select',
      options: defaultOptions.map((x) => x.value!),
    },
  },
  args: {
    options: defaultOptions,
    disabled: false,
  },
} as Meta;

const longTextOptions: Array<SelectableValue<string>> = [
  {
    value: 'opt-1',
    label:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua',
  },
  {
    value: 'opt-2',
    label:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  },
  {
    value: 'opt-3',
    label:
      'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum',
  },
  {
    value: 'opt-4',
    label:
      'Nulla posuere sollicitudin aliquam ultrices sagittis orci a scelerisque purus. Congue quisque egestas diam in. Sit amet mattis vulputate enim nulla aliquet porttitor lacus. Augue lacus viverra vitae congue eu consequat ac.',
  },
  {
    value: 'opt-5',
    label:
      'Aliquam malesuada bibendum arcu vitae elementum curabitur vitae nunc sed. Elit eget gravida cum sociis natoque penatibus et magnis dis. Varius sit amet mattis vulputate. Et ultrices neque ornare aenean euismod elementum nisi quis eleifend.',
  },
];

export const Default: Story<typeof RadioButtonList> = (args) => (
  <div>
    <RadioButtonList name="default" options={defaultOptions} idSelector={(opt) => opt} {...args} />
  </div>
);

export const LongLabels = Default.bind({});
LongLabels.args = {
  options: longTextOptions,
};

export const ControlledComponent = Default.bind({});
ControlledComponent.args = {
  value: 'opt-2',
};
ControlledComponent.argTypes = {
  value: {
    options: defaultOptions.map((x) => x.value!),
  },
  disabledOptions: {
    control: 'multi-select',
    options: defaultOptions.map((x) => x.value!),
  },
};

export const DisabledOptions = Default.bind({});
DisabledOptions.args = {
  disabledOptions: ['opt-4', 'opt-5'],
};

export const DisabledCheckedOption = Default.bind({});
DisabledCheckedOption.args = {
  value: 'opt-2',
  disabledOptions: ['opt-1', 'opt-2', 'opt-3'],
};

export const DisabledList = Default.bind({});
DisabledList.args = {
  disabled: true,
};
