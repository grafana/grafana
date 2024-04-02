import React, { useCallback } from 'react';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { Field, RadioButtonGroup, Switch } from '@grafana/ui/src';

import { LineStyle } from '../types';

const options: Array<SelectableValue<LineStyle>> = [
  { value: LineStyle.Solid, label: 'Solid' },
  { value: LineStyle.Dashed, label: 'Dashed' },
  { value: LineStyle.Dotted, label: 'Dotted' },
];

export interface LineStyleConfig {
  lineStyle: LineStyle;
  animate?: boolean;
}

type Props = StandardEditorProps<LineStyleConfig>;

export const defaultLineStyleConfig: LineStyleConfig = {
  lineStyle: LineStyle.Solid,
  animate: false,
};

export const LineStyleEditor = ({ value, onChange }: Props) => {
  if (!value) {
    value = defaultLineStyleConfig;
  } else if (typeof value !== 'object') {
    value = {
      lineStyle: value,
      animate: false,
    };
  }

  const onLineStyleChange = useCallback(
    (lineStyle: LineStyle) => {
      onChange({ ...value, lineStyle });
    },
    [onChange, value]
  );

  const onAnimateChange = useCallback(
    (animate: boolean) => {
      onChange({ ...value, animate });
    },
    [onChange, value]
  );

  return (
    <>
      <RadioButtonGroup value={value.lineStyle} options={options} onChange={onLineStyleChange} fullWidth />
      {value.lineStyle !== LineStyle.Solid && (
        <Field label="Animate">
          <Switch value={value.animate} onChange={(e) => onAnimateChange(e.currentTarget.checked)} />
        </Field>
      )}
    </>
  );
};
