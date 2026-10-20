import { type Meta, type StoryFn } from '@storybook/react';
import { useState } from 'react';

import { RangeSliderG14 } from './RangeSliderG14';

const meta: Meta<typeof RangeSliderG14> = {
  title: 'Inputs/RangeSliderG14',
  component: RangeSliderG14,
  args: {
    min: 0,
    max: 100,
  },
};

export const Controlled: StoryFn<typeof RangeSliderG14> = (args) => {
  const [value, setValue] = useState([10, 62]);

  return (
    <div style={{ width: '200px', height: '200px' }}>
      <RangeSliderG14
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
