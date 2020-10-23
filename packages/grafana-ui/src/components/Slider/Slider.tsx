import React, { useState, useCallback, ChangeEvent, FunctionComponent } from 'react';
import SliderComponent from 'rc-slider';
import { cx } from 'emotion';
import { Global } from '@emotion/core';
import { useTheme } from '../../themes/ThemeContext';
import { Orientation } from '../../types/orientation';
import { getStyles } from './styles';

export interface Props {
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

export const Slider: FunctionComponent<Props> = ({
  min,
  max,
  onChange,
  onAfterChange,
  orientation = 'horizontal',
  reverse,
  step,
  value,
}) => {
  const isHorizontal = orientation === 'horizontal';
  const theme = useTheme();
  const styles = getStyles(theme, isHorizontal);
  const SliderWithTooltip = SliderComponent;
  const [slidervalue, setSliderValue] = useState<number>(value || min);
  const onSliderChange = useCallback((v: number) => {
    setSliderValue(v);

    if (onChange) {
      onChange(v);
    }
  }, []);
  const onSliderInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    let v = +e.target.value;

    v > max && (v = max);
    v < min && (v = min);

    setSliderValue(v);

    if (onChange) {
      onChange(v);
    }

    if (onAfterChange) {
      onAfterChange(v);
    }
  }, []);
  return (
    <div className={cx(styles.container, styles.slider)}>
      {/** Slider tooltip's parent component is body and therefore we need Global component to do css overrides for it. */}
      <Global styles={styles.tooltip} />
      <label className={styles.sliderInput}>
        <SliderWithTooltip
          min={min}
          max={max}
          step={step}
          defaultValue={value}
          value={slidervalue}
          onChange={onSliderChange}
          onAfterChange={onAfterChange}
          vertical={!isHorizontal}
          reverse={reverse}
        />
        <input
          className={cx(styles.sliderInputField)}
          type="number"
          value={`${slidervalue}`} // to fix the react leading zero issue
          onChange={onSliderInputChange}
          min={min}
          max={max}
        />
      </label>
    </div>
  );
};

Slider.displayName = 'Slider';
