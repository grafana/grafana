import { Orientation } from '../../types/orientation';

export interface SliderProps {
  min: number;
  max: number;
  orientation?: Orientation;
  /** Set current positions of handle(s). If only 1 value supplied, only 1 handle displayed. */
  value?: number;
  reverse?: boolean;
  step?: number;
  tooltipAlwaysVisible?: boolean;
  formatTooltipResult?: (value: number) => number;
  onChange?: (value: number) => void;
  onAfterChange?: (value?: number) => void;
}

export interface RangeSliderProps {
  min: number;
  max: number;
  orientation?: Orientation;
  /** Set current positions of handle(s). If only 1 value supplied, only 1 handle displayed. */
  value?: number[];
  reverse?: boolean;
  step?: number;
  tooltipAlwaysVisible?: boolean;
  formatTooltipResult?: (value: number) => number | string;
  onChange?: (value: number[]) => void;
  onAfterChange?: (value: number[]) => void;
}
