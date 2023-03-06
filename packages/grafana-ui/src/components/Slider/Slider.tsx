import { cx } from '@emotion/css';
import { Global } from '@emotion/react';
import SliderComponent from 'rc-slider';
import React, { useState, useCallback, ChangeEvent, FunctionComponent, FocusEvent } from 'react';

import { useTheme2 } from '../../themes/ThemeContext';
import { Input } from '../Input/Input';

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
  ariaLabelForHandle,
  marks,
  included,
}) => {
  const isHorizontal = orientation === 'horizontal';
  const theme = useTheme2();
  const styles = getStyles(theme, isHorizontal, Boolean(marks));
  const SliderWithTooltip = SliderComponent;
  const [sliderValue, setSliderValue] = useState<number>(value ?? min);

  const onSliderChange = useCallback(
    (v: number | number[]) => {
      const value = typeof v === 'number' ? v : v[0];

      setSliderValue(value);
      onChange?.(value);
    },
    [setSliderValue, onChange]
  );

  const onSliderInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      let v = +e.target.value;

      if (Number.isNaN(v)) {
        v = 0;
      }

      setSliderValue(v);

      if (onChange) {
        onChange(v);
      }

      if (onAfterChange) {
        onAfterChange(v);
      }
    },
    [onChange, onAfterChange]
  );

  // Check for min/max on input blur so user is able to enter
  // custom values that might seem above/below min/max on first keystroke
  const onSliderInputBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const v = +e.target.value;

      if (v > max) {
        setSliderValue(max);
      } else if (v < min) {
        setSliderValue(min);
      }
    },
    [max, min]
  );

  const handleAfterChange = useCallback(
    (v: number | number[]) => {
      const value = typeof v === 'number' ? v : v[0];
      onAfterChange?.(value);
    },
    [onAfterChange]
  );

  const sliderInputClassNames = !isHorizontal ? [styles.sliderInputVertical] : [];
  const sliderInputFieldClassNames = !isHorizontal ? [styles.sliderInputFieldVertical] : [];

  return (
    <div className={cx(styles.container, styles.slider)}>
      {/** Slider tooltip's parent component is body and therefore we need Global component to do css overrides for it. */}
      <Global styles={styles.tooltip} />
      <div className={cx(styles.sliderInput, ...sliderInputClassNames)}>
        <SliderWithTooltip
          min={min}
          max={max}
          step={step}
          defaultValue={value}
          value={sliderValue}
          onChange={onSliderChange}
          onAfterChange={handleAfterChange}
          vertical={!isHorizontal}
          reverse={reverse}
          ariaLabelForHandle={ariaLabelForHandle}
          marks={marks}
          included={included}
        />

        <Input
          type="text"
          className={cx(styles.sliderInputField, ...sliderInputFieldClassNames)}
          value={sliderValue}
          onChange={onSliderInputChange}
          onBlur={onSliderInputBlur}
          min={min}
          max={max}
        />
      </div>
    </div>
  );
};

Slider.displayName = 'Slider';
