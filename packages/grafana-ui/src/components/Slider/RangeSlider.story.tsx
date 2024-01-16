import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { RangeSlider } from '@grafana/ui';

const meta: Meta<typeof RangeSlider> = {
  title: 'Forms/Slider/Range',
  component: RangeSlider,
  parameters: {
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
      <RangeSlider {...args} value={[10, 62]} />
    </div>
  );
};

export const Vertical: StoryFn<typeof RangeSlider> = (args) => {
  return (
    <div style={{ width: '200px', height: '200px' }}>
      <RangeSlider {...args} value={[10, 62]} orientation="vertical" />
    </div>
  );
};

export default meta;
