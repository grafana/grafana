import React, { useState, useCallback, ChangeEvent, FunctionComponent } from 'react';
import SliderComponent from 'rc-slider';
import { cx } from 'emotion';
import { Global } from '@emotion/core';
import { useTheme } from '../../themes/ThemeContext';
import { getStyles } from './styles';
import { SliderProps } from './types';

/**
 * @public
 */
export const Slider: FunctionComponent<SliderProps> = ({
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
  const sliderInputClassNames = !isHorizontal ? [styles.sliderInputVertical] : [];
  const sliderInputFieldClassNames = !isHorizontal ? [styles.sliderInputFieldVertical] : [];
  return (
    <div className={cx(styles.container, styles.slider)}>
      {/** Slider tooltip's parent component is body and therefore we need Global component to do css overrides for it. */}
      <Global styles={styles.tooltip} />
      <label className={cx(styles.sliderInput, ...sliderInputClassNames)}>
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
          className={cx(styles.sliderInputField, ...sliderInputFieldClassNames)}
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
