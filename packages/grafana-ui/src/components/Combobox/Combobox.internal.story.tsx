import { action } from '@storybook/addon-actions';
import { Meta, StoryFn, StoryObj } from '@storybook/react';
import { Chance } from 'chance';
import { ComponentProps, useMemo, useState } from 'react';

import { Combobox, Option, Value } from './Combobox';

const chance = new Chance();

type PropsAndCustomArgs = ComponentProps<typeof Combobox> & { numberOfOptions: number };

const meta: Meta<PropsAndCustomArgs> = {
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

function generateOptions(amount: number): Option[] {
  return Array.from({ length: amount }, () => ({
    label: chance.name(),
    value: chance.guid(),
    description: chance.sentence(),
  }));
}

const manyOptions = generateOptions(1e5);
manyOptions.push({ label: 'Banana', value: 'banana', description: 'A yellow fruit' });

const ManyOptionsStory: StoryFn<PropsAndCustomArgs> = ({ numberOfOptions }) => {
  const [value, setValue] = useState<Value>(manyOptions[5].value);
  const options = useMemo(() => generateOptions(numberOfOptions), [numberOfOptions]);
  return (
    <Combobox
      options={options}
      value={value}
      onChange={(val) => {
        setValue(val.value);
        action('onChange')(val);
      }}
    />
  );
};

export const ManyOptions: StoryObj<PropsAndCustomArgs> = {
  args: {
    numberOfOptions: 1e5,
    options: undefined,
    value: undefined,
  },
  render: ManyOptionsStory,
};

export default meta;
