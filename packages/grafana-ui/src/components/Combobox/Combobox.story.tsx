import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/preview-api';
import { Meta, StoryFn, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';

import { Field } from '../Forms/Field';

import { Combobox, ComboboxProps } from './Combobox';
import mdx from './Combobox.mdx';
import { fakeSearchAPI, generateOptions } from './storyUtils';
import { ComboboxOption } from './types';

type PropsAndCustomArgs<T extends string | number = string> = ComboboxProps<T> & {
  numberOfOptions: number;
};
type Story<T extends string | number = string> = StoryObj<PropsAndCustomArgs<T>>;

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
};
export default meta;

const loadOptionsAction = action('options called');
const onChangeAction = action('onChange called');

const BaseCombobox: StoryFn<PropsAndCustomArgs> = (args) => {
  const [dynamicArgs, setArgs] = useArgs();

  return (
    <Field label="Test input" description="Input with a few options">
      <Combobox
        id="test-combobox"
        {...args}
        {...dynamicArgs}
        onChange={(value: ComboboxOption | null) => {
          setArgs({ value: value?.value || null });
          onChangeAction(value);
        }}
      />
    </Field>
  );
};

export const Basic: Story = {
  render: BaseCombobox,
};

export const AutoSize: Story = {
  args: {
    width: 'auto',
    minWidth: 5,
    maxWidth: 200,
  },
  render: BaseCombobox,
};

export const CustomValue: Story = {
  args: {
    createCustomValue: true,
  },
  render: BaseCombobox,
};

export const ManyOptions: Story = {
  args: {
    numberOfOptions: 1e5,
    options: undefined,
    value: undefined,
  },
  render: ({ numberOfOptions, ...args }: PropsAndCustomArgs) => {
    const [dynamicArgs, setArgs] = useArgs();
    const [options, setOptions] = useState<ComboboxOption[]>([]);

    useEffect(() => {
      setTimeout(() => {
        generateOptions(numberOfOptions).then((options) => {
          setOptions(options);
          setArgs({ value: options[5].value });
        });
      }, 1000);
    }, [numberOfOptions, setArgs]);

    const { onChange, ...rest } = args;
    return (
      <Field label="Test input" description={options.length ? 'Input with a few options' : 'Preparing options...'}>
        <Combobox
          {...rest}
          {...dynamicArgs}
          options={options}
          onChange={(value: ComboboxOption | null) => {
            setArgs({ value: value?.value || null });
            onChangeAction(value);
          }}
        />
      </Field>
    );
  },
};

function loadOptionsWithLabels(inputValue: string) {
  loadOptionsAction(inputValue);
  return fakeSearchAPI(`http://example.com/search?errorOnQuery=break&query=${inputValue}`);
}

export const AsyncOptionsWithLabels: Story = {
  name: 'Async - values + labels',
  args: {
    options: loadOptionsWithLabels,
    value: { label: 'Option 69', value: '69' },
    placeholder: 'Select an option',
  },
  render: (args: PropsAndCustomArgs) => {
    const [dynamicArgs, setArgs] = useArgs();

    return (
      <Field
        label='Async options fn returns objects like { label: "Option 69", value: "69" }'
        description="Search for 'break' to see an error"
      >
        <Combobox
          {...args}
          {...dynamicArgs}
          onChange={(value: ComboboxOption | null) => {
            onChangeAction(value);
            setArgs({ value });
          }}
        />
      </Field>
    );
  },
};

function loadOptionsOnlyValues(inputValue: string) {
  loadOptionsAction(inputValue);
  return fakeSearchAPI(`http://example.com/search?errorOnQuery=break&query=${inputValue}`).then((options) =>
    options.map((opt) => ({ value: opt.label! }))
  );
}

export const AsyncOptionsWithOnlyValues: Story = {
  name: 'Async - values only',
  args: {
    options: loadOptionsOnlyValues,
    value: { value: 'Option 69' },
    placeholder: 'Select an option',
  },
  render: (args: PropsAndCustomArgs) => {
    const [dynamicArgs, setArgs] = useArgs();

    return (
      <Field
        label='Async options fn returns objects like { value: "69" }'
        description="Search for 'break' to see an error"
      >
        <Combobox
          {...args}
          {...dynamicArgs}
          onChange={(value: ComboboxOption | null) => {
            onChangeAction(value);
            setArgs({ value });
          }}
        />
      </Field>
    );
  },
};

const noop = () => {};

export const PositioningTest: Story = {
  render: (args: PropsAndCustomArgs) => {
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
  },
};
