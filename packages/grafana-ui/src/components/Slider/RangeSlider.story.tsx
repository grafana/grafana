import React from 'react';
import { RangeSlider } from '@grafana/ui';
import { select, number, boolean } from '@storybook/addon-knobs';

export default {
  title: 'Forms/Slider/Range',
  component: RangeSlider,
};

const getKnobs = () => {
  return {
    min: number('min', 0),
    max: number('max', 100),
    step: boolean('enable step', false),
    orientation: select('orientation', ['horizontal', 'vertical'], 'horizontal'),
    reverse: boolean('reverse', false),
  };
};

const SliderWrapper = () => {
  const { min, max, orientation, reverse, step } = getKnobs();
  const stepValue = step ? 10 : undefined;
  return (
    <div style={{ width: '200px', height: '200px' }}>
      <RangeSlider min={min} max={max} step={stepValue} orientation={orientation} value={[10, 20]} reverse={reverse} />
    </div>
  );
};

export const basic = () => <SliderWrapper />;
