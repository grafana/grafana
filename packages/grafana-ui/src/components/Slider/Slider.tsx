import React, { useState, useCallback, ChangeEvent, FunctionComponent } from 'react';
import SliderComponent from 'rc-slider';
import { cx } from 'emotion';
import { Global } from '@emotion/core';
import { useTheme } from '../../themes/ThemeContext';
import { getStyles } from './styles';
import { SliderProps } from './types';
import { Input } from '../Input/Input';

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

  const onSliderChange = useCallback(
    (v: number) => {
      setSliderValue(v);

      if (onChange) {
        onChange(v);
      }
    },
    [setSliderValue, onChange]
  );

  const onSliderInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      let v = +e.target.value;

      if (Number.isNaN(v)) {
        v = 0;
      }

      v > max && (v = max);
      v < min && (v = min);

      setSliderValue(v);

      if (onChange) {
        onChange(v);
      }

      if (onAfterChange) {
        onAfterChange(v);
      }
    },
    [setSliderValue, onAfterChange]
  );

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
        {/* Uses text input so that the number spinners are not shown */}
        <Input
          type="text"
          className={cx(styles.sliderInputField, ...sliderInputFieldClassNames)}
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
