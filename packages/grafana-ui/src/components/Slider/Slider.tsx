import { cx } from '@emotion/css';
import { Global } from '@emotion/react';
import SliderComponent from 'rc-slider';
import { useState, useCallback, ChangeEvent, FocusEvent } from 'react';

import { useStyles2 } from '../../themes/ThemeContext';
import { Input } from '../Input/Input';

import { getStyles } from './styles';
import { SliderProps } from './types';

/**
 * @public
 */
export const Slider = ({
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
}: SliderProps) => {
  const isHorizontal = orientation === 'horizontal';
  const styles = useStyles2(getStyles, isHorizontal, Boolean(marks));
  const SliderWithTooltip = SliderComponent;

  const [numericValue, setNumericValue] = useState<number>(value ?? min);
  const [inputValue, setInputValue] = useState<string>((value ?? min).toString());

  const onSliderChange = useCallback(
    (v: number | number[]) => {
      const num = typeof v === 'number' ? v : v[0];
      setNumericValue(num);
      setInputValue(num.toString());
      onChange?.(num);
    },
    [onChange]
  );

  const handleChangeComplete = useCallback(
    (v: number | number[]) => {
      const num = typeof v === 'number' ? v : v[0];
      onAfterChange?.(num);
    },
    [onAfterChange]
  );

  const onSliderInputChange = useCallback(
  (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    
    // Always update the raw input string to show exactly what user typed
    setInputValue(raw);

    // Parse and validate the number
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      // Allow the numeric value to temporarily go outside min/max while typing
      // (it will be clamped on blur)
      setNumericValue(parsed);
      onChange?.(parsed);
    }
  },
  [onChange]
);



  const onSliderInputBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      let parsed = parseFloat(e.target.value);
      if (isNaN(parsed)) {
        parsed = min;
      }

      // Clamp to min/max
      parsed = Math.max(min, Math.min(max, parsed));

      // Update both numeric and string values with the clamped result
      setNumericValue(parsed);
      setInputValue(parsed.toString());
      onChange?.(parsed);
      onAfterChange?.(parsed);
    },
    [min, max, onChange, onAfterChange]
  );

  const sliderInputClassNames = !isHorizontal ? [styles.sliderInputVertical] : [];
  const sliderInputFieldClassNames = !isHorizontal ? [styles.sliderInputFieldVertical] : [];

  return (
    <div className={cx(styles.container, styles.slider)}>
      <Global styles={styles.tooltip} />
      <div className={cx(styles.sliderInput, ...sliderInputClassNames)}>
        <SliderWithTooltip
          min={min}
          max={max}
          step={step ?? 0.1}
          value={numericValue}
          onChange={onSliderChange}
          onChangeComplete={handleChangeComplete}
          vertical={!isHorizontal}
          reverse={reverse}
          ariaLabelForHandle={ariaLabelForHandle}
          marks={marks}
          included={included}
        />

        <Input
          type="text"
          width={7.5}
          className={cx(styles.sliderInputField, ...sliderInputFieldClassNames)}
          value={inputValue}
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
