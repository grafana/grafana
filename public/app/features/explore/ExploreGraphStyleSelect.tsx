import { SelectableValue } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';
import { FieldConfig, storeStyle, getStyle, updateFieldConfig, ExploreGraphStyle } from './exploreGraphStyle';
import React from 'react';

const ALL_STYLE_OPTIONS: Array<SelectableValue<ExploreGraphStyle>> = [
  {
    label: 'Lines',
    value: 'lines',
  },
  {
    label: 'Bars',
    value: 'bars',
  },
  {
    label: 'Points',
    value: 'points',
  },
  {
    label: 'Stacked lines',
    value: 'stacked_lines',
  },
  {
    label: 'Stacked bars',
    value: 'stacked_bars',
  },
];

type Props = {
  fieldConfig: FieldConfig;
  onChange: (newConfig: FieldConfig) => void;
};

export function ExploreGraphStyleSelect({ fieldConfig, onChange }: Props) {
  const style = getStyle(fieldConfig);

  const handleStyleChange = (value: ExploreGraphStyle) => {
    storeStyle(value);
    const newConfig = updateFieldConfig(fieldConfig, value);
    onChange(newConfig);
  };

  return <RadioButtonGroup size="sm" options={ALL_STYLE_OPTIONS} value={style} onChange={handleStyleChange} />;
}
