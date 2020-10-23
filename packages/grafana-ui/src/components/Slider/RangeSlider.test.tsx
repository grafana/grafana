import React from 'react';
import { RangeSlider, Props } from './RangeSlider';
import { render } from '@testing-library/react';

const sliderProps: Props = {
  min: 10,
  max: 20,
};

describe('RangeSlider', () => {
  it('renders without error', () => {
    expect(() => {
      render(<RangeSlider {...sliderProps} />);
    });
  });
});
