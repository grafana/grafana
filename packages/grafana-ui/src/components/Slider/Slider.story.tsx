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
    reverse: boolean('reverse', false),
  };
};

const SliderWrapper = () => {
  const { min, max, orientation, reverse, step } = getKnobs();
  const stepValue = step ? 10 : undefined;
  return (
    <div style={{ width: '300px', height: '300px' }}>
      <Slider min={min} max={max} step={stepValue} orientation={orientation} value={10} reverse={reverse} />
    </div>
  );
};

export const basic = () => <SliderWrapper />;
