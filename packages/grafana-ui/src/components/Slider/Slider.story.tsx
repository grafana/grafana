import { Story, Meta } from '@storybook/react';
import React from 'react';

import { Slider } from '@grafana/ui';

import { Orientation } from '../../types/orientation';

import { SliderProps } from './types';

export default {
  title: 'Forms/Slider',
  component: Slider,
  parameters: {
    controls: {
      exclude: ['step', 'formatTooltipResult', 'onChange', 'onAfterChange', 'value', 'tooltipAlwaysVisible'],
    },
    knobs: {
      disabled: true,
    },
  },
  argTypes: {
    isStep: { name: 'Step' },
    orientation: { control: { type: 'select', options: ['horizontal', 'vertical'] } },
  },
} as Meta;

const commonArgs = {
  min: 0,
  max: 100,
  value: 10,
  isStep: false,
  orientation: 'horizontal' as Orientation,
  reverse: false,
  included: true,
};

interface StoryProps extends Partial<SliderProps> {
  isStep: boolean;
}

export const Basic: Story<StoryProps> = (args) => {
  return (
    <div style={{ width: '300px', height: '300px' }}>
      <Slider
        step={args.isStep ? 10 : undefined}
        value={args.value}
        min={args.min as number}
        max={args.max as number}
        {...args}
      />
    </div>
  );
};
Basic.args = {
  ...commonArgs,
};

export const WithMarks: Story<StoryProps> = (args) => {
  return (
    <div style={{ width: '300px', height: '300px' }}>
      <Slider
        step={args.isStep ? 10 : undefined}
        value={args.value}
        min={args.min as number}
        max={args.max as number}
        {...args}
      />
    </div>
  );
};
WithMarks.args = {
  ...commonArgs,
  marks: { 0: '0', 25: '25', 50: '50', 75: '75', 100: '100' },
};
