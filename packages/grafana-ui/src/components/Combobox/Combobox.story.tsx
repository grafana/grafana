import { action } from '@storybook/addon-actions';
import { Meta, StoryFn, StoryObj } from '@storybook/react';
import { Chance } from 'chance';
import React, { ComponentProps, useEffect, useState } from 'react';

import { useTheme2 } from '../../themes/ThemeContext';
import { Alert } from '../Alert/Alert';
import { Divider } from '../Divider/Divider';
import { Field } from '../Forms/Field';
import { Select } from '../Select/Select';

import { Combobox, ComboboxOption } from './Combobox';

const chance = new Chance();

type PropsAndCustomArgs = ComponentProps<typeof Combobox> & { numberOfOptions: number };

const meta: Meta<PropsAndCustomArgs> = {
  title: 'Forms/Combobox',
  component: Combobox,
  args: {
    loading: undefined,
    invalid: undefined,
    width: undefined,
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
  decorators: [InDevDecorator],
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

async function generateOptions(amount: number): Promise<ComboboxOption[]> {
  return Array.from({ length: amount }, (_, index) => ({
    label: chance.sentence({ words: index % 5 }),
    value: chance.guid(),
  }));
}

const ManyOptionsStory: StoryFn<PropsAndCustomArgs> = ({ numberOfOptions, ...args }) => {
  const [value, setValue] = useState<string | null>(null);
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      generateOptions(numberOfOptions).then((options) => {
        setIsLoading(false);
        setOptions(options);
        setValue(options[5].value);
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

const SelectComparisonStory: StoryFn<typeof Combobox> = (args) => {
  const [comboboxValue, setComboboxValue] = useState(args.value);
  const theme = useTheme2();

  return (
    <div style={{ border: '1px solid ' + theme.colors.border.weak, padding: 16 }}>
      <Field label="Combobox with default size">
        <Combobox
          id="combobox-default-size"
          value={comboboxValue}
          options={args.options}
          onChange={(val) => {
            setComboboxValue(val?.value || null);
            action('onChange')(val);
          }}
        />
      </Field>

      <Field label="Select with default size">
        <Select
          id="select-default-size"
          value={comboboxValue}
          options={args.options}
          onChange={(val) => {
            setComboboxValue(val?.value || null);
            action('onChange')(val);
          }}
        />
      </Field>

      <Divider />

      <Field label="Combobox with explicit size (25)">
        <Combobox
          id="combobox-explicit-size"
          width={25}
          value={comboboxValue}
          options={args.options}
          onChange={(val) => {
            setComboboxValue(val?.value || null);
            action('onChange')(val);
          }}
        />
      </Field>

      <Field label="Select with explicit size (25)">
        <Select
          id="select-explicit-size"
          width={25}
          value={comboboxValue}
          options={args.options}
          onChange={(val) => {
            setComboboxValue(val?.value || null);
            action('onChange')(val);
          }}
        />
      </Field>

      <Divider />

      <Field label="Combobox with auto width, minWidth 15">
        <Combobox
          id="combobox-auto-size"
          width="auto"
          minWidth={15}
          value={comboboxValue}
          options={args.options}
          onChange={(val) => {
            setComboboxValue(val?.value || null);
            action('onChange')(val);
          }}
        />
      </Field>

      <Field label="Select with auto width">
        <Select
          id="select-auto-size"
          width="auto"
          value={comboboxValue}
          options={args.options}
          onChange={(val) => {
            setComboboxValue(val?.value || null);
            action('onChange')(val);
          }}
        />
      </Field>

      <Field label="Combobox with auto width, minWidth 15, empty value">
        <Combobox
          id="combobox-auto-size-empty"
          width="auto"
          minWidth={15}
          value={null}
          options={args.options}
          onChange={(val) => {
            setComboboxValue(val?.value || null);
            action('onChange')(val);
          }}
        />
      </Field>

      <Field label="Select with auto width, empty value">
        <Select
          id="select-auto-size-empty"
          width="auto"
          value={null}
          options={args.options}
          onChange={(val) => {
            setComboboxValue(val?.value || null);
            action('onChange')(val);
          }}
        />
      </Field>
    </div>
  );
};

export const AutoSize: StoryObj<PropsAndCustomArgs> = {
  args: {
    width: 'auto',
    minWidth: 5,
    maxWidth: 200,
  },
};

export const ManyOptions: StoryObj<PropsAndCustomArgs> = {
  args: {
    numberOfOptions: 1e5,
    options: undefined,
    value: undefined,
  },
  render: ManyOptionsStory,
};

export const CustomValue: StoryObj<PropsAndCustomArgs> = {
  args: {
    createCustomValue: true,
  },
};

export const ComparisonToSelect: StoryObj<PropsAndCustomArgs> = {
  args: {
    numberOfOptions: 100,
  },
  render: SelectComparisonStory,
};

export default meta;

function InDevDecorator(Story: React.ElementType) {
  return (
    <div>
      <Alert title="This component is still in development!" severity="info">
        Combobox is still in development and not able to be used externally.
        <br />
        Within the Grafana repo, it can be used by importing it from{' '}
        <span style={{ fontFamily: 'monospace' }}>@grafana/ui/src/unstable</span>
      </Alert>
      <Story />
    </div>
  );
}
