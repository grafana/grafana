import React from 'react';

import { Slider } from './Slider';
import { select, number } from '@storybook/addon-knobs';

const getStory = (title: string, component: any) => ({
  title,
  parameters: {
    component,
  },
});

export default getStory('General/Slider', Slider);

const getKnobs = () => {
  return {
    min: number('min', 0),
    max: number('max', 100),
    orientation: select('orientation', ['horizontal', 'vertical'], 'vertical'),
  };
};

const SliderWrapper = () => {
  const { min, max, orientation } = getKnobs();
  return <Slider min={min} max={max} orientation={orientation} />;
};

export const basic = () => <SliderWrapper />;
