import { action } from '@storybook/addon-actions';
import { Meta, StoryFn, StoryObj } from '@storybook/react';
import { Chance } from 'chance';
import { ComponentProps, useEffect, useState } from 'react';

import { Field } from '../Forms/Field';

import { Combobox, Option, Value } from './Combobox';

const chance = new Chance();

type PropsAndCustomArgs = ComponentProps<typeof Combobox> & { numberOfOptions: number };

const meta: Meta<PropsAndCustomArgs> = {
  title: 'Forms/Combobox',
  component: Combobox,
  args: {
    loading: undefined,
    invalid: undefined,
    width: 30,
    placeholder: 'Select an option...',
    options: [
      { label: 'Apple', value: 'apple' },
      { label: 'Banana', value: 'banana' },
      { label: 'Carrot', value: 'carrot' },
      // Long label to test overflow
      {
        label:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        value: 'long-text',
      },
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
    <Field label="Test input" description="Input with a few options">
      <Combobox
        id="test-combobox"
        {...args}
        value={value}
        onChange={(val) => {
          setValue(val?.value || null);
          action('onChange')(val);
        }}
      />
    </Field>
  );
};

type Story = StoryObj<typeof Combobox>;

export const Basic: Story = {};

async function generateOptions(amount: number): Promise<Option[]> {
  return Array.from({ length: amount }, (_, index) => ({
    label: chance.sentence({ words: index % 5 }),
    value: chance.guid(),
    //description: chance.sentence(),
  }));
}

const ManyOptionsStory: StoryFn<PropsAndCustomArgs> = ({ numberOfOptions, ...args }) => {
  const [value, setValue] = useState<Value | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      generateOptions(numberOfOptions).then((options) => {
        setIsLoading(false);
        setOptions(options);
        setValue(options[5].value);
        console.log("I've set stuff");
      });
    }, 1000);
  }, [numberOfOptions]);

  return (
    <Combobox
      {...args}
      loading={isLoading}
      options={options}
      value={value}
      onChange={(opt) => {
        setValue(opt?.value || null);
        action('onChange')(opt);
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
