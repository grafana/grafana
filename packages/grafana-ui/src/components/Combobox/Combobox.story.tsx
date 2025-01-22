import { action } from '@storybook/addon-actions';
import { Meta, StoryFn, StoryObj } from '@storybook/react';
import React, { ComponentProps, useCallback, useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';

import { Alert } from '../Alert/Alert';
import { Field } from '../Forms/Field';
import { AsyncSelect } from '../Select/Select';

import { Combobox, ComboboxOption } from './Combobox';
import mdx from './Combobox.mdx';

type PropsAndCustomArgs<T extends string | number = string> = ComponentProps<typeof Combobox<T>> & {
  numberOfOptions: number;
};

const meta: Meta<PropsAndCustomArgs> = {
  title: 'Forms/Combobox',
  component: Combobox,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  args: {
    loading: undefined,
    invalid: undefined,
    width: 20,
    isClearable: false,
    placeholder: 'Select an option...',
    options: [
      {
        label: 'Apple',
        value: 'apple',
        description: 'Apples are a great source of fiber and vitamin C.',
      },
      {
        label: 'Banana',
        value: 'banana',
        description:
          'Bananas are a great source of potassium, fiber, and vitamin C. They are also a great snack for on the go.',
      },
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
      {
        label: 'Iceberg Lettuce',
        value: 'iceberg-lettuce',
        description:
          'this is a very long description that should be longer than the longest option label which should make it clip to only one line. It is a bit tough to estimate the width of the descriptions because the font size is smaller, but this should be enough.',
      },
      { label: 'Jackfruit', value: 'jackfruit' },
    ],
    value: 'banana',
  },

  render: (args) => <BasicWithState {...args} />,
  decorators: [InDevDecorator],
};

const BasicWithState: StoryFn<PropsAndCustomArgs> = (args) => {
  const [value, setValue] = useState<string | null>();
  return (
    <Field label="Test input" description="Input with a few options">
      <Combobox
        id="test-combobox"
        {...args}
        value={value}
        onChange={(val: ComboboxOption | null) => {
          // TODO: Figure out how to update value on args
          setValue(val?.value || null);
          action('onChange')(val);
        }}
      />
    </Field>
  );
};

type Story = StoryObj<typeof Combobox>;

export const Basic: Story = {};

export async function generateOptions(amount: number): Promise<ComboboxOption[]> {
  return Array.from({ length: amount }, (_, index) => ({
    label: 'Option ' + index,
    value: index.toString(),
  }));
}

const ManyOptionsStory: StoryFn<PropsAndCustomArgs<string>> = ({ numberOfOptions, ...args }) => {
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

  const { onChange, ...rest } = args;
  return (
    <Combobox
      {...rest}
      loading={isLoading}
      options={options}
      value={value}
      onChange={(opt: ComboboxOption | null) => {
        setValue(opt?.value || null);
        action('onChange')(opt);
      }}
    />
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

  const { onChange, ...rest } = args;

  return (
    <>
      <Field
        label="Options with labels"
        description="This tests when options have both a label and a value. Consumers are required to pass in a full ComboboxOption as a value with a label"
      >
        <Combobox
          {...rest}
          id="test-combobox-one"
          placeholder="Select an option"
          options={loadOptionsWithLabels}
          value={selectedOption}
          onChange={(val: ComboboxOption | null) => {
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
          onChange={(val: ComboboxOption | null) => {
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
          onChange={(val: ComboboxOption | null) => {
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
