import { action } from '@storybook/addon-actions';
import { useArgs, useEffect, useState } from '@storybook/preview-api';
import type { Meta, StoryFn, StoryObj } from '@storybook/react';

import { ComboboxOption } from './Combobox';
import { generateOptions } from './Combobox.story';
import { MultiCombobox } from './MultiCombobox';

const meta: Meta<typeof MultiCombobox> = {
  title: 'Forms/MultiCombobox',
  component: MultiCombobox,
};

const commonArgs = {
  options: [
    { label: 'Option 1', value: 'option1' },
    { label: 'Option 2', value: 'option2' },
    { label: 'Option 3', value: 'option3' },
    { label: 'Option 4', value: 'option4' },
    { label: 'Option 5', value: 'option5' },
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
