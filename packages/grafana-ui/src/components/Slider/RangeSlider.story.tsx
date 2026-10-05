import { type Meta, type StoryFn } from '@storybook/react';
import { useState } from 'react';

import { RangeSlider } from './RangeSlider';
import mdx from './RangeSlider.mdx';

const meta: Meta<typeof RangeSlider> = {
  title: 'Inputs/RangeSlider',
  component: RangeSlider,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['tooltipAlwaysVisible'],
    },
  },
  argTypes: {
    orientation: { control: { type: 'select', options: ['horizontal', 'vertical'] } },
    step: { control: { type: 'number', min: 1 } },
  },
  args: {
    min: 0,
    max: 100,
    orientation: 'horizontal',
    reverse: false,
    step: undefined,
  },
};

export const Basic: StoryFn<typeof RangeSlider> = (args) => {
  return (
    <div style={{ width: '200px', height: '200px' }}>
      <RangeSlider {...args} defaultValue={[10, 62]} />
    </div>
  );
};

export const Vertical: StoryFn<typeof RangeSlider> = (args) => {
  return (
    <div style={{ width: '200px', height: '200px' }}>
      <RangeSlider {...args} defaultValue={[10, 62]} orientation="vertical" />
    </div>
  );
};

export const Controlled: StoryFn<typeof RangeSlider> = (args) => {
  const [value, setValue] = useState([10, 62]);

  return (
    <div style={{ width: '200px', height: '200px' }}>
      <RangeSlider
        {...args}
        value={value}
        onChange={(nextValue) => {
          setValue(nextValue);
          args.onChange?.(nextValue);
        }}
      />
    </div>
  );
};

export default meta;
