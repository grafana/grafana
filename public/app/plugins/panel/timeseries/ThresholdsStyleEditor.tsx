import React, { useCallback } from 'react';

import { FieldOverrideEditorProps, SelectableValue } from '@grafana/data';
import { GraphTresholdsStyleMode } from '@grafana/schema';
import { Select } from '@grafana/ui';

export const ThresholdsStyleEditor: React.FC<
  FieldOverrideEditorProps<SelectableValue<{ mode: GraphTresholdsStyleMode }>, any>
> = ({ item, value, onChange, id }) => {
  const onChangeCb = useCallback(
    (v: SelectableValue<GraphTresholdsStyleMode>) => {
      onChange({
        mode: v.value,
      });
    },
    [onChange]
  );
  return <Select inputId={id} value={value.mode} options={item.settings.options} onChange={onChangeCb} />;
};
