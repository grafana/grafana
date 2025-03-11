import { action } from '@storybook/addon-actions';
import { useArgs, useEffect, useState } from '@storybook/preview-api';
import type { Meta, StoryFn, StoryObj } from '@storybook/react';
import { ComponentProps } from 'react';

import { Field } from '../Forms/Field';

import { MultiCombobox } from './MultiCombobox';
import mdx from './MultiCombobox.mdx';
import { generateOptions, fakeSearchAPI, generateGroupingOptions } from './storyUtils';
import { ComboboxOption } from './types';

const meta: Meta<typeof MultiCombobox> = {
  title: 'Forms/MultiCombobox',
  component: MultiCombobox,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const loadOptionsAction = action('options called');
const onChangeAction = action('onChange called');

const commonArgs = {
  options: [
    { label: 'wasd - 1', value: 'option1' },
    { label: 'wasd - 2', value: 'option2' },
    { label: 'wasd - 3', value: 'option3' },
    { label: 'asdf - 1', value: 'option4' },
    { label: 'asdf - 2', value: 'option5' },
  ],
  value: ['option2'],
  placeholder: 'Select multiple options...',
};

export default meta;

type storyArgs = ComponentProps<typeof MultiCombobox>;
type ManyOptionsArgs = storyArgs & { numberOfOptions?: number };

type Story = StoryObj<typeof MultiCombobox>;

export const Basic: Story = {
  args: commonArgs,
  render: (args) => {
    const [{ value }, setArgs] = useArgs();

    return (
      <MultiCombobox
        {...args}
        value={value}
        onChange={(val) => {
          onChangeAction(val);
          setArgs({ value: val });
        }}
      />
    );
  },
};

export const AutoSize: Story = {
  args: { ...commonArgs, width: 'auto', minWidth: 20 },
  render: (args) => {
    const [{ value }, setArgs] = useArgs();

    return (
      <MultiCombobox
        {...args}
        value={value}
        onChange={(val) => {
          action('onChange')(val);
          setArgs({ value: val });
        }}
      />
    );
  },
};

const ManyOptionsStory: StoryFn<ManyOptionsArgs> = ({ numberOfOptions = 1e4, ...args }) => {
  const [dynamicArgs, setArgs] = useArgs();

  const [options, setOptions] = useState<ComboboxOption[]>([]);

  useEffect(() => {
    setTimeout(async () => {
      const options = await generateOptions(numberOfOptions);
      setOptions(options);
    }, 1000);
  }, [numberOfOptions]);

  const { onChange, ...rest } = args;
  return (
    <MultiCombobox
      {...rest}
      {...dynamicArgs}
      options={options}
      onChange={(opts) => {
        setArgs({ value: opts });
        onChangeAction(opts);
      }}
    />
  );
};

export const ManyOptions: StoryObj<ManyOptionsArgs> = {
  args: {
    numberOfOptions: 1e4,
    options: undefined,
    value: undefined,
  },
  render: ManyOptionsStory,
};

const ManyOptionsGroupedStory: StoryFn<ManyOptionsArgs> = ({ numberOfOptions = 1e5, ...args }) => {
  const [dynamicArgs, setArgs] = useArgs();

  const [options, setOptions] = useState<ComboboxOption[]>([]);

  useEffect(() => {
    setTimeout(async () => {
      const options = await generateGroupingOptions(numberOfOptions);
      setOptions(options);
    }, 1000);
  }, [numberOfOptions]);
  const { onChange, ...rest } = args;
  return (
    <MultiCombobox
      {...rest}
      {...dynamicArgs}
      options={options}
      onChange={(opts) => {
        setArgs({ value: opts });
        onChangeAction(opts);
      }}
    />
  );
};

export const ManyOptionsGrouped: StoryObj<ManyOptionsArgs> = {
  args: {
    numberOfOptions: 1e4,
    options: undefined,
    value: undefined,
  },
  render: ManyOptionsGroupedStory,
};

function loadOptionsWithLabels(inputValue: string) {
  loadOptionsAction(inputValue);
  return fakeSearchAPI(`http://example.com/search?errorOnQuery=break&query=${inputValue}`);
}

export const AsyncOptionsWithLabels: Story = {
  name: 'Async - options returns labels',
  args: {
    options: loadOptionsWithLabels,
    value: [{ label: 'Option 69', value: '69' }],
    placeholder: 'Select an option',
  },
  render: (args) => {
    const [dynamicArgs, setArgs] = useArgs();

    return (
      <Field
        label='Async options fn returns objects like { label: "Option 69", value: "69" }'
        description="Search for 'break' to see an error"
      >
        <MultiCombobox
          {...args}
          {...dynamicArgs}
          onChange={(val) => {
            onChangeAction(val);
            setArgs({ value: val });
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
  name: 'Async - options returns only values',
  args: {
    options: loadOptionsOnlyValues,
    value: [{ value: 'Option 69' }],
    placeholder: 'Select an option',
  },
  render: (args) => {
    const [dynamicArgs, setArgs] = useArgs();

    return (
      <Field
        label='Async options fn returns objects like { value: "69" }'
        description="Search for 'break' to see an error"
      >
        <MultiCombobox
          {...args}
          {...dynamicArgs}
          onChange={(val) => {
            onChangeAction(val);
            setArgs({ value: val });
          }}
        />
      </Field>
    );
  },
};
