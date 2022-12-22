import { SliderMarks } from '@grafana/data';

import { Orientation } from '../../types/orientation';

interface CommonSliderProps {
  min: number;
  max: number;
  orientation?: Orientation;
  /** Set current positions of handle(s). If only 1 value supplied, only 1 handle displayed. */
  reverse?: boolean;
  step?: number;
  tooltipAlwaysVisible?: boolean;
  /** Marks on the slider. The key determines the position, and the value determines what will show. If you want to set the style of a specific mark point, the value should be an object which contains style and label properties. */
  marks?: SliderMarks;
  /** If the value is true, it means a continuous value interval, otherwise, it is a independent value. */
  included?: boolean;
}
export interface SliderProps extends CommonSliderProps {
  value?: number;
  onChange?: (value: number) => void;
  onAfterChange?: (value?: number) => void;
  formatTooltipResult?: (value: number) => number;
  ariaLabelForHandle?: string;
}

export interface RangeSliderProps extends CommonSliderProps {
  value?: number[];
  onChange?: (value: number[]) => void;
  onAfterChange?: (value?: number[]) => void;
  formatTooltipResult?: (value: number) => number | string;
}
