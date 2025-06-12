import { useCallback } from 'react';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field, RadioButtonGroup, Switch } from '@grafana/ui';

import { LineStyle } from '../types';

const options: Array<SelectableValue<LineStyle>> = [
  { value: LineStyle.Solid, label: 'Solid' },
  { value: LineStyle.Dashed, label: 'Dashed' },
  { value: LineStyle.Dotted, label: 'Dotted' },
];

export interface LineStyleConfig {
  style: LineStyle;
  animate?: boolean;
}

type Props = StandardEditorProps<LineStyleConfig>;

export const defaultLineStyleConfig: LineStyleConfig = {
  style: LineStyle.Solid,
  animate: false,
};

export const LineStyleEditor = ({ value, onChange }: Props) => {
  if (!value) {
    value = defaultLineStyleConfig;
  } else if (typeof value !== 'object') {
    value = {
      style: value,
      animate: false,
    };
  }

  const onLineStyleChange = useCallback(
    (lineStyle: LineStyle) => {
      onChange({ ...value, style: lineStyle });
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
      <RadioButtonGroup value={value.style} options={options} onChange={onLineStyleChange} fullWidth />
      {value.style !== LineStyle.Solid && (
        <>
          <br />
          <Field label={t('canvas.line-style-editor.label-animate', 'Animate')}>
            <Switch value={value.animate} onChange={(e) => onAnimateChange(e.currentTarget.checked)} />
          </Field>
        </>
      )}
    </>
  );
};
