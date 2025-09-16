import { Meta, StoryFn } from '@storybook/react';

import { RangeSlider } from './RangeSlider';

const meta: Meta<typeof RangeSlider> = {
  title: 'Inputs/RangeSlider',
  component: RangeSlider,
  parameters: {
    controls: {
      exclude: ['tooltipAlwaysVisible'],
    },
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
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
