import { action } from '@storybook/addon-actions';
import { useArgs, useEffect, useState } from '@storybook/preview-api';
import type { Meta, StoryFn, StoryObj } from '@storybook/react';
import { useCallback } from 'react';

import { MultiCombobox } from './MultiCombobox';
import { generateOptions, fakeSearchAPI } from './storyUtils';
import { ComboboxOption } from './types';

const meta: Meta<typeof MultiCombobox> = {
  title: 'Forms/MultiCombobox',
  component: MultiCombobox,
};

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

type storyArgs = React.ComponentProps<typeof MultiCombobox>;
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
          action('onChange')(val);
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
  const [value, setValue] = useState<string[]>([]);
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      generateOptions(numberOfOptions).then((options) => {
        setIsLoading(false);
        setOptions(options);
        setValue([options[5].value]);
      });
    }, 1000);
  }, [numberOfOptions]);

  const { onChange, ...rest } = args;
  return (
    <MultiCombobox
      {...rest}
      loading={isLoading}
      options={options}
      value={value}
      onChange={(opts) => {
        setValue(opts || []);
        action('onChange')(opts);
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

const loadOptionsAction = action('loadOptions called');
const AsyncStory: StoryFn = (args) => {
  // Combobox
  const [selectedOption, setSelectedOption] = useState<Array<ComboboxOption<string>> | undefined>([]);

  // This simulates a kind of search API call
  const loadOptionsWithLabels = useCallback((inputValue: string) => {
    loadOptionsAction(inputValue);
    return fakeSearchAPI(`http://example.com/search?query=${inputValue}`);
  }, []);

  const { onChange, ...rest } = args;

  return (
    <MultiCombobox
      {...rest}
      id="test-combobox-one"
      placeholder="Select an option"
      options={loadOptionsWithLabels}
      value={selectedOption}
      onChange={(val: any[] | undefined) => {
        action('onChange')(val);
        setSelectedOption(val);
      }}
      createCustomValue={args.createCustomValue}
    />
  );
};

export const Async: StoryObj = {
  render: AsyncStory,
};
