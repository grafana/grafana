import { cx } from '@emotion/css';
import { Global } from '@emotion/react';
import SliderComponent from 'rc-slider';
import { useState, useCallback, ChangeEvent, FocusEvent, useEffect } from 'react';
import { usePrevious } from 'react-use';

import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Input } from '../Input/Input';

import { getStyles } from './styles';
import { SliderProps } from './types';

function stripAndParseNumber(raw: string): number {
  const str = raw.replace(/^0+/, '');
  let decimal = false;
  let numericBody = '';
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charAt(i);

    // take digits
    if (/\d/.test(char)) {
      numericBody += char;
    }
    // take the first period
    if (char === '.' && !decimal) {
      decimal = true;
      numericBody += '.';
    }
    // take only a leading negative sign
    if (char === '-' && numericBody.length === 0) {
      numericBody = '-';
    }

    // anything else is thrown away
  }
  const value = Number(numericBody);
  return value;
}

// gets rid of pesky things like 1.20000000000000002 and such, since this needs to be printed
// nicely for people.
function roundFloatingPointError(n: number) {
  return parseFloat(n.toPrecision(12));
}

function clampToAllowedValue(min: number, max: number, step: number, n: number): number {
  // default to min
  if (Number.isNaN(n)) {
    return min;
  }

  // clamp to max and min
  if (n > max) {
    return max;
  }
  if (n < min) {
    return min;
  }

  // ensure the value is exactly one of the allowed steps
  // find the closest step
  const closestStep = roundFloatingPointError(Math.round((n - min) / step) * step + min);

  // clamp the closest found step to min/max
  // this should never be needed unless the step isn't divisible by max-min, but it's a
  // quick and easy check to include.
  return Math.min(max, Math.max(min, closestStep));
}

/**
 * @public
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-slider--docs
 */
export const Slider = ({
  min,
  max,
  onChange,
  onAfterChange,
  orientation = 'horizontal',
  reverse,
  step = 1,
  value,
  ariaLabelForHandle,
  marks,
  included,
  inputId,
  showInput = true,
}: SliderProps) => {
  const isHorizontal = orientation === 'horizontal';
  const styles = useStyles2(getStyles, isHorizontal, Boolean(marks));
  const SliderWithTooltip = SliderComponent;

  const [inputValue, setInputValue] = useState<string>((value ?? min).toString());
  const numericValue = clampToAllowedValue(min, max, step, stripAndParseNumber(inputValue));

  // State synchronization. This is a hack since we have to maintain our own source of truth for the text input
  const previousValue = usePrevious(value);
  const externalValueChanged = value !== previousValue && value !== numericValue;
  useEffect(() => {
    if (externalValueChanged && value !== undefined) {
      // This only causes a re-render if the value is actually different, which should
      // only happen if the value is externally changed
      setInputValue(String(value));
    }
  }, [externalValueChanged, value]);

  const dragHandleAriaLabel =
    ariaLabelForHandle ?? t('grafana-ui.slider.drag-handle-aria-label', 'Use arrow keys to change the value');

  const onSliderChange = useCallback(
    (v: number | number[]) => {
      const num = typeof v === 'number' ? v : v[0];
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

  const onTextInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      // Update the raw input string to show what user typed, except the special case of `0-`, which
      // should result in just `-` as a user convenience.
      setInputValue(raw === '0-' ? '-' : raw);

      // Parse and validate the number
      const parsed = stripAndParseNumber(raw);
      if (onChange && !Number.isNaN(parsed)) {
        // Clamp the output value
        onChange(clampToAllowedValue(min, max, step, parsed));
      }
    },
    [onChange, min, max, step]
  );

  const onTextInputBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const parsed = clampToAllowedValue(min, max, step, stripAndParseNumber(e.target.value));

      // Update both numeric and string values with the clamped result
      setInputValue(parsed.toString());
      onChange?.(parsed);
      onAfterChange?.(parsed);
    },
    [min, max, step, onChange, onAfterChange]
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
          ariaLabelForHandle={dragHandleAriaLabel}
          marks={marks}
          included={included}
        />

        {showInput && (
          <Input
            type="text"
            width={7.5}
            className={cx(styles.sliderInputField, ...sliderInputFieldClassNames)}
            value={inputValue}
            onChange={onTextInputChange}
            onBlur={onTextInputBlur}
            min={min}
            max={max}
            id={inputId}
          />
        )}
      </div>
    </div>
  );
};

Slider.displayName = 'Slider';
