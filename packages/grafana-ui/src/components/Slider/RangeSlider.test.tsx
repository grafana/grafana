import { render } from '@testing-library/react';

import { RangeSlider } from './RangeSlider';
import { RangeSliderProps } from './types';

const sliderProps: RangeSliderProps = {
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
