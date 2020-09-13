import React from 'react';
import { Slider } from '@grafana/ui';
import { select, number, boolean } from '@storybook/addon-knobs';

export default {
  title: 'Forms/Slider',
  component: Slider,
};

const getKnobs = () => {
  return {
    min: number('min', 0),
    max: number('max', 100),
    step: boolean('enable step', false),
    orientation: select('orientation', ['horizontal', 'vertical'], 'horizontal'),
    reverse: boolean('reverse', true),
    singleValue: boolean('single value', false),
  };
};

const SliderWrapper = () => {
  const { min, max, orientation, reverse, singleValue, step } = getKnobs();
  const stepValue = step ? 10 : undefined;
  return (
    <div style={{ width: '200px', height: '200px' }}>
      <Slider
        min={min}
        max={max}
        step={stepValue}
        orientation={orientation}
        value={singleValue ? [10] : undefined}
        reverse={reverse}
      />
    </div>
  );
};

export const basic = () => <SliderWrapper />;
