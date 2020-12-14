import React, { useCallback } from 'react';
import { InlineField, Switch } from '@grafana/ui';
import { FieldConfigEditorProps } from '@grafana/data';
import { HideSeriesConfig } from '@grafana/ui/src/components/uPlot/config';

export const SeriesConfigEditor: React.FC<FieldConfigEditorProps<HideSeriesConfig, {}>> = props => {
  const { value, onChange } = props;

  const onChangeToggle = useCallback(
    (prop: keyof HideSeriesConfig) => {
      onChange({ ...value, [prop]: !value[prop] });
    },
    [value, onChange]
  );

  return (
    <>
      <InlineField labelWidth={10} label="Legend">
        <Switch value={value.legend} onChange={() => onChangeToggle('legend')} />
      </InlineField>
      <InlineField labelWidth={10} label="Graph">
        <Switch value={value.graph} onChange={() => onChangeToggle('graph')} />
      </InlineField>
      <InlineField labelWidth={10} label="Tooltip">
        <Switch value={value.tooltip} onChange={() => onChangeToggle('tooltip')} />
      </InlineField>
    </>
  );
};
