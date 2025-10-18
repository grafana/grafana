import { css, cx } from '@emotion/css';
import { Global } from '@emotion/react';
import Slider from 'rc-slider';
import { useCallback, useEffect, useRef, useState } from 'react';

import { StandardEditorProps, GrafanaTheme2, SliderFieldConfigSettings } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { getSliderStyles } from '@grafana/ui/internal';

import { NumberInput } from './NumberInput';

type Props = StandardEditorProps<number, SliderFieldConfigSettings>;

export const SliderValueEditor = ({ value, onChange, item, id }: Props) => {
  // Input reference
  const inputRef = useRef<HTMLSpanElement>(null);

  // Settings
  const { settings } = item;
  const min = settings?.min || 0;
  const max = settings?.max || 100;
  const step = settings?.step;
  const marks = settings?.marks || { [min]: min, [max]: max };
  const included = settings?.included;
  const ariaLabelForHandle = settings?.ariaLabelForHandle;

  // Core slider specific parameters and state
  const inputWidthDefault = 75;
  const isHorizontal = true;
  const theme = useTheme2();
  const [sliderValue, setSliderValue] = useState<number>(value ?? min);
  const [inputWidth, setInputWidth] = useState<number>(inputWidthDefault);

  // Check for a difference between prop value and internal state
  useEffect(() => {
    if (value != null && value !== sliderValue) {
      setSliderValue(value);
    }
  }, [value, sliderValue]);

  // Using input font and expected maximum number of digits, set input width
  useEffect(() => {
    const inputElement = getComputedStyle(inputRef.current!);
    const fontWeight = inputElement.getPropertyValue('font-weight') || 'normal';
    const fontSize = inputElement.getPropertyValue('font-size') || '16px';
    const fontFamily = inputElement.getPropertyValue('font-family') || 'Arial';
    const wideNumericalCharacter = '0';
    const marginDigits = 4; // extra digits to account for things like negative, exponential, and controls
    const inputPadding = 8; // TODO: base this on input styling
    const maxDigits =
      Math.max((max + (step || 0)).toString().length, (max - (step || 0)).toString().length) + marginDigits;
    const refString = wideNumericalCharacter.repeat(maxDigits);
    const calculatedTextWidth = getTextWidth(refString, `${fontWeight} ${fontSize} ${fontFamily}`);
    if (calculatedTextWidth) {
      setInputWidth(calculatedTextWidth + inputPadding * 2);
    }
  }, [max, step]);

  const onSliderChange = useCallback(
    (v: number | number[]) => {
      const value = typeof v === 'number' ? v : v[0];
      setSliderValue(value);

      if (onChange) {
        onChange(value);
      }
    },
    [setSliderValue, onChange]
  );

  const onSliderInputChange = useCallback(
    (value?: number) => {
      let v = value;

      if (Number.isNaN(v) || !v) {
        v = 0;
      }

      setSliderValue(v);

      if (onChange) {
        onChange(v);
      }
    },
    [onChange]
  );

  // Styles
  const styles = getSliderStyles(theme, isHorizontal, Boolean(marks));
  const stylesSlider = getStylesSlider(theme, inputWidth);
  const sliderInputClassNames = !isHorizontal ? [styles.sliderInputVertical] : [];

  return (
    <div className={cx(styles.container, styles.slider)}>
      {/** Slider tooltip's parent component is body and therefore we need Global component to do css overrides for it. */}
      <Global styles={styles.slider} />
      <div className={cx(styles.sliderInput, ...sliderInputClassNames)}>
        <Slider
          min={min}
          max={max}
          step={step}
          defaultValue={value}
          value={sliderValue}
          onChange={onSliderChange}
          vertical={!isHorizontal}
          reverse={false}
          ariaLabelForHandle={ariaLabelForHandle}
          marks={marks}
          included={included}
        />
        <span className={stylesSlider.numberInputWrapper} ref={inputRef}>
          <NumberInput id={id} value={sliderValue} onChange={onSliderInputChange} max={max} min={min} step={step} />
        </span>
      </div>
    </div>
  );
};

// Calculate width of string with given font
function getTextWidth(text: string, font: string): number | null {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (context) {
    context.font = font;
    const metrics = context.measureText(text);
    return metrics.width;
  }
  return null;
}

const getStylesSlider = (theme: GrafanaTheme2, width: number) => {
  return {
    numberInputWrapper: css({
      marginLeft: theme.spacing(3),
      maxHeight: '32px',
      maxWidth: width,
      minWidth: width,
      overflow: 'visible',
      width: '100%',
    }),
  };
};
