import { type Meta, type StoryFn } from '@storybook/react-webpack5';
import { useState } from 'react';

import { FilterInput } from './FilterInput';
import mdx from './FilterInput.mdx';

const meta: Meta<typeof FilterInput> = {
  title: 'Inputs/FilterInput',
  component: FilterInput,
  argTypes: {
    variant: { control: { type: 'select', options: ['search', 'filter'] } },
  },
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic: StoryFn<typeof FilterInput> = (args) => {
  const [value, setValue] = useState('');

  return <FilterInput {...args} value={value} onChange={setValue} />;
};

Basic.args = {
  placeholder: 'Filter...',
  variant: 'filter',
};

export default meta;
