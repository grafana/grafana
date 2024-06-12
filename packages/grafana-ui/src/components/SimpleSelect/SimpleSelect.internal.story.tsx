import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import React, { useState } from 'react';

import { SimpleSelect } from './SimpleSelect';

const meta: Meta<typeof SimpleSelect> = {
  title: 'Forms/SimpleSelect',
  component: SimpleSelect,
  args: {
    placeholder: 'Select an option',
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

export const Basic: StoryFn<typeof SimpleSelect> = (args) => {
  const [value, setValue] = useState(args.value);
  return (
    <SimpleSelect
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
