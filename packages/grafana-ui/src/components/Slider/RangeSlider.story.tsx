import React from 'react';
import { RangeSlider } from '@grafana/ui';
import { RangeSliderProps } from './types';
import { Meta, Story } from '@storybook/react';

export default {
  title: 'Forms/Slider/Range',
  component: RangeSlider,
  parameters: {
    controls: {
      exclude: ['tooltipAlwaysVisible'],
    },
  },
  argTypes: {
    isStep: { name: 'step' },
    orientation: { control: { type: 'select', options: ['horizontal', 'vertical'] } },
  },
} as Meta;

interface StoryProps extends Partial<RangeSliderProps> {
  isStep: boolean;
}

export const Basic: Story<StoryProps> = (args) => {
  return (
    <div style={{ width: '200px', height: '200px' }}>
      <RangeSlider
        step={args.isStep ? 10 : undefined}
        value={[10, 20]}
        min={args.min as number}
        max={args.max as number}
        {...args}
      />
    </div>
  );
};
Basic.args = {
  min: 0,
  max: 100,
  isStep: false,
  orientation: 'horizontal',
  reverse: false,
};
