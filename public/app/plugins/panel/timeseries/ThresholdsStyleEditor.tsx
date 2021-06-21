import React, { useCallback } from 'react';
import { FieldOverrideEditorProps, SelectableValue } from '@grafana/data';
import { GraphTresholdsStyleMode, Select } from '@grafana/ui';

export const ThresholdsStyleEditor: React.FC<
  FieldOverrideEditorProps<SelectableValue<{ mode: GraphTresholdsStyleMode }>, any>
> = ({ item, value, onChange }) => {
  console.log(value);
  const onChangeCb = useCallback(
    (v: SelectableValue<GraphTresholdsStyleMode>) => {
      onChange({
        mode: v.value,
      });
    },
    [onChange]
  );
  return <Select value={value.mode} options={item.settings.options} onChange={onChangeCb} />;
};
