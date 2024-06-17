import { action } from '@storybook/addon-actions';
import { Meta, StoryFn, StoryObj } from '@storybook/react';
import { Chance } from 'chance';
import React, { useState } from 'react';

import { Combobox, Value } from './Combobox';

const chance = new Chance();

const meta: Meta<typeof Combobox> = {
  title: 'Forms/Combobox',
  component: Combobox,
  args: {
    loading: undefined,
    invalid: undefined,
    placeholder: 'Select an option...',
    options: [
      { label: 'Apple', value: 'apple' },
      { label: 'Banana', value: 'banana' },
      { label: 'Carrot', value: 'carrot' },
      { label: 'Dill', value: 'dill' },
      { label: 'Eggplant', value: 'eggplant' },
      { label: 'Fennel', value: 'fennel' },
      { label: 'Grape', value: 'grape' },
      { label: 'Honeydew', value: 'honeydew' },
      { label: 'Iceberg Lettuce', value: 'iceberg-lettuce' },
      { label: 'Jackfruit', value: 'jackfruit' },
      { label: '1', value: 1 },
      { label: '2', value: 2 },
      { label: '3', value: 3 },
    ],
    value: 'banana',
  },

  render: (args) => <BasicWithState {...args} />,
};

const BasicWithState: StoryFn<typeof Combobox> = (args) => {
  const [value, setValue] = useState(args.value);
  return (
    <Combobox
      {...args}
      value={value}
      onChange={(val) => {
        setValue(val.value);
        action('onChange')(val);
      }}
    />
  );
};

type Story = StoryObj<typeof Combobox>;

export const Basic: Story = {};

function generateOptions(amount: number) {
  return Array.from({ length: amount }, () => ({
    label: chance.name(),
    value: chance.guid(),
  }));
}

const manyOptions = generateOptions(1e5);
manyOptions.push({ label: 'Banana', value: 'banana' });

export const ManyOptions: StoryFn<typeof Combobox> = (args) => {
  const [value, setValue] = useState<Value>(manyOptions[5].value);
  return (
    <Combobox
      {...args}
      options={manyOptions}
      value={value}
      onChange={(val) => {
        setValue(val.value);
        action('onChange')(val);
      }}
    />
  );
};

export default meta;
