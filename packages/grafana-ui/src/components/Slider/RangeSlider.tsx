import { RangeSliderG14 } from './RangeSliderG14';
import { type RangeSliderProps } from './types';

/** @public */
export const RangeSlider = ({ defaultValue, value, ...props }: RangeSliderProps) => {
  return <RangeSliderG14 {...props} defaultValue={defaultValue ?? value} />;
};

RangeSlider.displayName = 'RangeSlider';
