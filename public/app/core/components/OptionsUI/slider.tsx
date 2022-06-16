import { cx } from '@emotion/css';
import { Global } from '@emotion/react';
import SliderComponent from 'rc-slider';
import React, { useCallback, useEffect, useState } from 'react';

import { FieldConfigEditorProps, SliderFieldConfigSettings } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { getStyles } from '../../../../../packages/grafana-ui/src/components/Slider/styles';

import { NumberInput } from './NumberInput';

export const SliderValueEditor: React.FC<FieldConfigEditorProps<number, SliderFieldConfigSettings>> = ({
  value,
  onChange,
  item,
}) => {
  const { settings } = item;
  const min = settings?.min || 0;
  const max = settings?.max || 100;
  const step = settings?.step;
  const marks = settings?.marks;
  const included = settings?.included;
  const ariaLabelForHandle = settings?.ariaLabelForHandle;

  const isHorizontal = true;
  const theme = useTheme2();
  const styles = getStyles(theme, isHorizontal, Boolean(marks));
  const SliderWithTooltip = SliderComponent;
  const [sliderValue, setSliderValue] = useState<number>(value ?? min);

  // Check for a difference between prop value and internal state
  useEffect(() => {
    if (value != null && value !== sliderValue) {
      setSliderValue(value);
    }
  }, [value, sliderValue]);

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

  const sliderInputClassNames = !isHorizontal ? [styles.sliderInputVertical] : [];

  return (
    <div className={cx(styles.container, styles.slider)}>
      {/** Slider tooltip's parent component is body and therefore we need Global component to do css overrides for it. */}
      <Global styles={styles.slider} />
      <label className={cx(styles.sliderInput, ...sliderInputClassNames)}>
        <SliderWithTooltip
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
        {/* Uses text input so that the number spinners are not shown */}
        <NumberInput value={sliderValue} onChange={onSliderInputChange} max={settings?.max} min={settings?.min} />
      </label>
    </div>
  );
};
