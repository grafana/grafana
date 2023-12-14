import React, { useCallback } from 'react';

import { StandardEditorProps, SelectableValue } from '@grafana/data';
import { GraphTresholdsStyleMode } from '@grafana/schema';
import { Select } from '@grafana/ui';

type Props = StandardEditorProps<
  SelectableValue<{ mode: GraphTresholdsStyleMode }>,
  { options: Array<SelectableValue<GraphTresholdsStyleMode>> }
>;

export const ThresholdsStyleEditor = ({ item, value, onChange, id }: Props) => {
  const onChangeCb = useCallback(
    (v: SelectableValue<GraphTresholdsStyleMode>) => {
      onChange({
        mode: v.value,
      });
    },
    [onChange]
  );
  return <Select inputId={id} value={value.mode} options={item.settings?.options ?? []} onChange={onChangeCb} />;
};
