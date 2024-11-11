import { action } from '@storybook/addon-actions';
import { Meta, StoryFn, StoryObj } from '@storybook/react';
import React, { ComponentProps, useCallback, useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { Alert } from '../Alert/Alert';
import { Divider } from '../Divider/Divider';
import { Field } from '../Forms/Field';
import { AsyncSelect, Select } from '../Select/Select';

import { Combobox, ComboboxOption } from './Combobox';

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
      { label: '4', value: 4 },
      { label: '5', value: 5 },
      { label: '6', value: 6 },
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
    label: 'Option ' + index,
    value: index.toString(),
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

  if (typeof args.options === 'function') {
    throw new Error('This story does not support async options');
  }

  return (
    <div style={{ border: '1px solid ' + theme.colors.border.weak, padding: 16 }}>
      <Field label="Combobox with default size">
        <Combobox
          {...args}
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
        {/*@ts-ignore minWidth and maxWidth has never, which is incompatible with args. It lacks the context that width=25 on the component*/}
        <Combobox
          {...args}
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
          {...args}
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
          {...args}
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

const loadOptionsAction = action('loadOptions called');
const AsyncStory: StoryFn<PropsAndCustomArgs> = (args) => {
  // Combobox
  const [selectedOption, setSelectedOption] = useState<ComboboxOption<string> | null>(null);

  // AsyncSelect
  const [asyncSelectValue, setAsyncSelectValue] = useState<SelectableValue<string> | null>(null);

  // This simulates a kind of search API call
  const loadOptionsWithLabels = useCallback((inputValue: string) => {
    loadOptionsAction(inputValue);
    return fakeSearchAPI(`http://example.com/search?query=${inputValue}`);
  }, []);

  const loadOptionsOnlyValues = useCallback((inputValue: string) => {
    return fakeSearchAPI(`http://example.com/search?query=${inputValue}`).then((options) =>
      options.map((opt) => ({ value: opt.label! }))
    );
  }, []);

  const loadOptionsWithErrors = useCallback((inputValue: string) => {
    if (inputValue.length % 2 === 0) {
      return fakeSearchAPI(`http://example.com/search?query=${inputValue}`);
    } else {
      throw new Error('Could not retrieve options');
    }
  }, []);

  return (
    <>
      <Field
        label="Options with labels"
        description="This tests when options have both a label and a value. Consumers are required to pass in a full ComboboxOption as a value with a label"
      >
        <Combobox
          {...args}
          id="test-combobox-one"
          placeholder="Select an option"
          options={loadOptionsWithLabels}
          value={selectedOption}
          onChange={(val) => {
            action('onChange')(val);
            setSelectedOption(val);
          }}
          createCustomValue={args.createCustomValue}
        />
      </Field>

      <Field
        label="Options without labels"
        description="Or without labels, where consumer can just pass in a raw scalar value Value"
      >
        <Combobox
          {...args}
          id="test-combobox-two"
          placeholder="Select an option"
          options={loadOptionsOnlyValues}
          value={selectedOption?.value ?? null}
          onChange={(val) => {
            action('onChange')(val);
            setSelectedOption(val);
          }}
          createCustomValue={args.createCustomValue}
        />
      </Field>

      <Field label="Async with error" description="An odd number of characters throws an error">
        <Combobox
          id="test-combobox-error"
          placeholder="Select an option"
          options={loadOptionsWithErrors}
          value={selectedOption}
          onChange={(val) => {
            action('onChange')(val);
            setSelectedOption(val);
          }}
        />
      </Field>

      <Field label="Compared to AsyncSelect">
        <AsyncSelect
          id="test-async-select"
          placeholder="Select an option"
          loadOptions={loadOptionsWithLabels}
          value={asyncSelectValue}
          defaultOptions
          onChange={(val) => {
            action('onChange')(val);
            setAsyncSelectValue(val);
          }}
        />
      </Field>

      <Field label="Async with error" description="An odd number of characters throws an error">
        <Combobox
          {...args}
          id="test-combobox-error"
          placeholder="Select an option"
          options={loadOptionsWithErrors}
          value={selectedOption}
          onChange={(val) => {
            action('onChange')(val);
            setSelectedOption(val);
          }}
        />
      </Field>
    </>
  );
};

export const Async: StoryObj<PropsAndCustomArgs> = {
  render: AsyncStory,
};

const noop = () => {};
const PositioningTestStory: StoryFn<PropsAndCustomArgs> = (args) => {
  if (typeof args.options === 'function') {
    throw new Error('This story does not support async options');
  }

  function renderColumnOfComboboxes(pos: string) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
        }}
      >
        <Combobox {...args} placeholder={`${pos} top`} options={args.options} value={null} onChange={noop} />
        <Combobox {...args} placeholder={`${pos} middle`} options={args.options} value={null} onChange={noop} />
        <Combobox {...args} placeholder={`${pos} bottom`} options={args.options} value={null} onChange={noop} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',

        // approx the height of the dev alert, and three margins. exact doesn't matter
        minHeight: 'calc(100vh - (105px + 16px + 16px + 16px))',
        justifyContent: 'space-between',
        gap: 32,
      }}
    >
      {renderColumnOfComboboxes('Left')}
      {renderColumnOfComboboxes('Middle')}
      {renderColumnOfComboboxes('Right')}
    </div>
  );
};

export const PositioningTest: StoryObj<PropsAndCustomArgs> = {
  render: PositioningTestStory,
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

let fakeApiOptions: Array<ComboboxOption<string>>;
async function fakeSearchAPI(urlString: string): Promise<Array<ComboboxOption<string>>> {
  const searchParams = new URL(urlString).searchParams;

  if (!fakeApiOptions) {
    fakeApiOptions = await generateOptions(1000);
  }

  const searchQuery = searchParams.get('query')?.toLowerCase();

  if (!searchQuery || searchQuery.length === 0) {
    return Promise.resolve(fakeApiOptions.slice(0, 10));
  }

  const filteredOptions = Promise.resolve(
    fakeApiOptions.filter((opt) => opt.label?.toLowerCase().includes(searchQuery))
  );

  const delay = searchQuery.length % 2 === 0 ? 200 : 1000;

  return new Promise<Array<ComboboxOption<string>>>((resolve) => {
    setTimeout(() => resolve(filteredOptions), delay);
  });
}
