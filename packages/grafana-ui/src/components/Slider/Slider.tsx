import React, { useState, useCallback, ChangeEvent, FunctionComponent, FocusEvent, KeyboardEvent } from 'react';
import SliderComponent from 'rc-slider';

import { cx } from '@emotion/css';
import { Global } from '@emotion/react';
import { useTheme2 } from '../../themes/ThemeContext';
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
    (v: number) => {
      if (v > max) {
        v = max;
      }
      if (v < min) {
        v = min;
      }

      setSliderValue(v);

      if (onChange) {
        onChange(v);
      }
    },
    [setSliderValue, onChange, min, max]
  );

  const onSliderInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      let v = +e.target.value;

      if (Number.isNaN(v)) {
        v = 0;
      }

      onSliderChange(v);

      if (onAfterChange) {
        onAfterChange(v);
      }
    },
    [onSliderChange, onAfterChange]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      //onSliderChange(value + step)
      if (isNaN(+e.key) && !e.ctrlKey) {
        switch (e.key) {
          case 'ArrowUp':
            onSliderChange(value! + (step ?? 1));
            break;
          case 'ArrowDown':
            onSliderChange(value! - (step ?? 1));
            break;

          // Do normal behavior
          case 'Backspace':
            return;

          // Skip everything else
          default:
            console.log('SKIP key', e.key);
        }
        e.preventDefault();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, step, onSliderChange]
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
          value={sliderValue}
          onChange={onSliderChange}
          onAfterChange={onAfterChange}
          vertical={!isHorizontal}
          reverse={reverse}
          ariaLabelForHandle={ariaLabelForHandle}
          marks={marks}
          included={included}
        />
        {/* Uses text input so that the number spinners are not shown */}
        <Input
          type="text"
          className={cx(styles.sliderInputField, ...sliderInputFieldClassNames)}
          value={`${sliderValue}`} // to fix the react leading zero issue
          onChange={onSliderInputChange}
          onBlur={onSliderInputBlur}
          onKeyDown={onKeyDown}
          min={min}
          max={max}
        />
      </label>
    </div>
  );
};

Slider.displayName = 'Slider';
