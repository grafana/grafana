import { action } from '@storybook/addon-actions';
import { useArgs, useEffect, useState } from '@storybook/preview-api';
import type { Meta, StoryFn, StoryObj } from '@storybook/react';
import { ComponentProps, useId } from 'react';

import { Field } from '../Forms/Field';

import { MultiCombobox } from './MultiCombobox';
import mdx from './MultiCombobox.mdx';
import { generateOptions, fakeSearchAPI, generateGroupingOptions } from './storyUtils';
import { ComboboxOption } from './types';

const meta: Meta<typeof MultiCombobox> = {
  title: 'Inputs/MultiCombobox',
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
    { label: 'Australia', value: 'option1' },
    { label: 'Austria', value: 'option2' },
    { label: 'Fiji', value: 'option3' },
    { label: 'Iceland', value: 'option4' },
    { label: 'Ireland', value: 'option5' },
    { label: 'Finland', value: 'option6' },
    { label: 'The Netherlands', value: 'option7' },
    { label: 'Switzerland', value: 'option8' },
    { label: 'United Kingdom of Great Britain and Northern Ireland ', value: 'option9' },
  ],
  value: ['option2'],
  placeholder: 'Select multiple options...',
};

export default meta;

type storyArgs = ComponentProps<typeof MultiCombobox>;
type ManyOptionsArgs = storyArgs & { numberOfOptions?: number };

type Story = StoryObj<typeof MultiCombobox>;

const BasicStory: StoryFn<typeof MultiCombobox> = (args) => {
  const [{ value }, setArgs] = useArgs();
  const comboboxId = useId();

  return (
    <Field label="Country">
      <MultiCombobox
        {...args}
        id={comboboxId}
        value={value}
        onChange={(val) => {
          onChangeAction(val);
          setArgs({ value: val });
        }}
      />
    </Field>
  );
};

export const Basic: Story = {
  args: commonArgs,
  render: BasicStory,
};

const WithInfoOptionStory: StoryFn<typeof MultiCombobox> = (args) => {
  const [{ value }, setArgs] = useArgs();
  const comboboxId = useId();

  return (
    <Field label="Country">
      <MultiCombobox
        {...args}
        id={comboboxId}
        value={value}
        onChange={(val) => {
          onChangeAction(val);
          setArgs({ value: val });
        }}
      />
    </Field>
  );
};

export const WithInfoOption: Story = {
  name: 'With infoOption',
  args: {
    ...commonArgs,
    options: [
      ...commonArgs.options,
      { label: 'Can’t find your country? Select “Other” or contact an admin', value: '__INFO__', infoOption: true },
    ],
  },
  render: WithInfoOptionStory,
};

const AutoSizeStory: StoryFn<typeof MultiCombobox> = (args) => {
  const [{ value }, setArgs] = useArgs();
  const comboboxId = useId();

  return (
    <Field label="Country">
      <MultiCombobox
        {...args}
        id={comboboxId}
        value={value}
        onChange={(val) => {
          action('onChange')(val);
          setArgs({ value: val });
        }}
      />
    </Field>
  );
};

export const AutoSize: Story = {
  args: { ...commonArgs, width: 'auto', minWidth: 20 },
  render: AutoSizeStory,
};

const ManyOptionsStory: StoryFn<ManyOptionsArgs> = ({ numberOfOptions = 1e4, ...args }) => {
  const [dynamicArgs, setArgs] = useArgs();
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const comboboxId = useId();

  useEffect(() => {
    setTimeout(async () => {
      const options = await generateOptions(numberOfOptions);
      setOptions(options);
    }, 1000);
  }, [numberOfOptions]);

  const { onChange, ...rest } = args;
  return (
    <Field label="Lots of options">
      <MultiCombobox
        {...rest}
        {...dynamicArgs}
        options={options}
        id={comboboxId}
        onChange={(opts) => {
          setArgs({ value: opts });
          onChangeAction(opts);
        }}
      />
    </Field>
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
  const comboboxId = useId();

  useEffect(() => {
    setTimeout(async () => {
      const options = await generateGroupingOptions(numberOfOptions);
      setOptions(options);
    }, 1000);
  }, [numberOfOptions]);
  const { onChange, ...rest } = args;
  return (
    <Field label="Lots of options with groups">
      <MultiCombobox
        {...rest}
        {...dynamicArgs}
        id={comboboxId}
        options={options}
        onChange={(opts) => {
          setArgs({ value: opts });
          onChangeAction(opts);
        }}
      />
    </Field>
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

const AsyncOptionsWithLabelsStory: StoryFn<typeof MultiCombobox> = (args) => {
  const [dynamicArgs, setArgs] = useArgs();
  const comboboxId = useId();

  return (
    <Field
      label='Async options fn returns objects like { label: "Option 69", value: "69" }'
      description="Search for 'break' to see an error"
    >
      <MultiCombobox
        {...args}
        {...dynamicArgs}
        id={comboboxId}
        onChange={(val) => {
          onChangeAction(val);
          setArgs({ value: val });
        }}
      />
    </Field>
  );
};

export const AsyncOptionsWithLabels: Story = {
  name: 'Async - options returns labels',
  args: {
    options: loadOptionsWithLabels,
    value: [{ label: 'Option 69', value: '69' }],
    placeholder: 'Select an option',
  },
  render: AsyncOptionsWithLabelsStory,
};

function loadOptionsOnlyValues(inputValue: string) {
  loadOptionsAction(inputValue);
  return fakeSearchAPI(`http://example.com/search?errorOnQuery=break&query=${inputValue}`).then((options) =>
    options.map((opt) => ({ value: opt.label! }))
  );
}

const AsyncOptionsWithOnlyValuesStory: StoryFn<typeof MultiCombobox> = (args) => {
  const [dynamicArgs, setArgs] = useArgs();
  const comboboxId = useId();

  return (
    <Field
      label='Async options fn returns objects like { value: "69" }'
      description="Search for 'break' to see an error"
    >
      <MultiCombobox
        {...args}
        {...dynamicArgs}
        id={comboboxId}
        onChange={(val) => {
          onChangeAction(val);
          setArgs({ value: val });
        }}
      />
    </Field>
  );
};

export const AsyncOptionsWithOnlyValues: Story = {
  name: 'Async - options returns only values',
  args: {
    options: loadOptionsOnlyValues,
    value: [{ value: 'Option 69' }],
    placeholder: 'Select an option',
  },
  render: AsyncOptionsWithOnlyValuesStory,
};
