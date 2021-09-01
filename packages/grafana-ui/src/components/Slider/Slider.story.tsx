import React from 'react';
import { Slider } from '@grafana/ui';
import { SliderProps } from './types';
import { Story, Meta } from '@storybook/react';

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
  min: 0,
  max: 100,
  value: 10,
  isStep: false,
  orientation: 'horizontal',
  reverse: false,
};
