import { useCallback } from 'react';

import { type StandardEditorProps, type SliderFieldConfigSettings } from '@grafana/data';
import { Slider } from '@grafana/ui';

type Props = StandardEditorProps<number, SliderFieldConfigSettings>;

export const SliderValueEditor = ({ value, onChange, item, id }: Props) => {
  // Settings
  const { settings } = item;
  const min = settings?.min || 0;
  const max = settings?.max || 100;
  const step = settings?.step;
  const marks = settings?.marks || { [min]: min, [max]: max };
  const included = settings?.included;
  const ariaLabelForHandle = settings?.ariaLabelForHandle;

  const onSliderChange = useCallback(
    (v: number | number[]) => {
      const value = typeof v === 'number' ? v : v[0];

      if (onChange) {
        onChange(value);
      }
    },
    [onChange]
  );

  return (
    <Slider
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onSliderChange}
      reverse={false}
      ariaLabelForHandle={ariaLabelForHandle}
      marks={marks}
      included={included}
    />
  );
};
