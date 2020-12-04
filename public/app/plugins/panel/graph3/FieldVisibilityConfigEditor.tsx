import React, { useCallback } from 'react';
import { FieldConfigEditorProps, SelectableValue } from '@grafana/data';
import { MultiSelect } from '@grafana/ui';
import { SeriesConfig } from '@grafana/ui/src/components/uPlot/config';

interface DisplayConfigEditorSettings {
  descriptions: Record<string, string>;
}

export const DisplayConfigEditor: React.FC<FieldConfigEditorProps<
  SeriesConfig,
  DisplayConfigEditorSettings
>> = props => {
  const { settings } = props.item;
  const values: string[] = [];
  const options: Array<SelectableValue<string>> = [];

  for (const key in props.value) {
    options.push({
      label: settings?.descriptions[key] ?? key,
      value: key,
    });

    if (!props.value[key]) {
      continue;
    }

    values.push(key);
  }

  const onChange = useCallback(
    (values: Array<SelectableValue<string>>) => {
      const next = { ...props.value };

      for (const key in props.value) {
        next[key] = !!values.find(sv => sv.value === key);
      }

      props.onChange(next);
    },
    [props.onChange, props.value]
  );

  return <MultiSelect isSearchable={false} options={options} value={values} onChange={onChange} />;
};
