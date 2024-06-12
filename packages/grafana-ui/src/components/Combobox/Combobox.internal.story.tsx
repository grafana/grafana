import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import React, { useState } from 'react';

import { Combobox } from './Combobox';

const meta: Meta<typeof Combobox> = {
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
    ],
    value: { label: 'Banana', value: 'banana' },
  },
};

export const Basic: StoryFn<typeof Combobox> = (args) => {
  const [value, setValue] = useState(args.value);
  return (
    <Combobox
      {...args}
      value={value}
      onChange={(val) => {
        setValue(val);
        action('onChange')(val);
      }}
    />
  );
};

export default meta;
