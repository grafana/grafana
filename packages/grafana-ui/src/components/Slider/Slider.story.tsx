import React from 'react';
import { Slider } from './Slider';
import { select, number, boolean } from '@storybook/addon-knobs';

export default {
  title: 'General/Slider',
  component: Slider,
};

const getKnobs = () => {
  return {
    min: number('min', 0),
    max: number('max', 100),
    orientation: select('orientation', ['horizontal', 'vertical'], 'horizontal'),
    reverse: boolean('reverse', true),
    singleValue: boolean('single value', false),
  };
};

const SliderWrapper = () => {
  const { min, max, orientation, reverse, singleValue } = getKnobs();
  return (
    <div style={{ width: '200px', height: '200px' }}>
      <Slider min={min} max={max} orientation={orientation} value={singleValue ? [10] : undefined} reverse={reverse} />
    </div>
  );
};

export const basic = () => <SliderWrapper />;
