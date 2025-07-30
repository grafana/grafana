import { Meta, StoryFn } from '@storybook/react';
import { useState } from 'react';

import { getAvailableIcons } from '../../types/icon';
import { Stack } from '../Layout/Stack/Stack';

import { FilterPill } from './FilterPill';
import mdx from './FilterPill.mdx';

const meta: Meta<typeof FilterPill> = {
  title: 'Inputs/FilterPill',
  component: FilterPill,
  argTypes: {
    icon: { control: { type: 'select', options: getAvailableIcons() } },
    onClick: { action: 'Pill Clicked' },
  },
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic: StoryFn<typeof FilterPill> = (args) => {
  return <FilterPill {...args} />;
};

export const Example = () => {
  const [selected, setSelected] = useState('Stockholm');
  const elements = ['Singapore', 'Paris', 'Stockholm', 'New York', 'London'];

  return (
    <Stack>
      {elements.map((item) => (
        <FilterPill key={item} label={item} selected={item === selected} onClick={() => setSelected(item)} />
      ))}
    </Stack>
  );
};

Basic.args = {
  selected: false,
  label: 'Test',
  icon: undefined,
};

export default meta;
