import React, { useCallback } from 'react';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui/src';

import { LineStyle } from '../types';

const options: Array<SelectableValue<LineStyle>> = [
  { value: LineStyle.Solid, label: 'Solid' },
  { value: LineStyle.Dashed, label: 'Dashed' },
  { value: LineStyle.Dotted, label: 'Dotted' },
];

export const LineStyleEditor = ({ value, onChange }: StandardEditorProps<string, undefined, undefined>) => {
  const lineStyle = value ?? LineStyle.Solid;

  const onLineStyleChange = useCallback(
    (lineStyle: string) => {
      onChange(lineStyle);
    },
    [onChange]
  );

  return <RadioButtonGroup value={lineStyle} options={options} onChange={onLineStyleChange} fullWidth />;
};
