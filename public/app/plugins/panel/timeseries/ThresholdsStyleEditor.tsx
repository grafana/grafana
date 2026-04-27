import { useCallback } from 'react';

import type { StandardEditorProps } from '@grafana/data/field';
import type { SelectableValue } from '@grafana/data/types';
import { type GraphThresholdsStyleMode } from '@grafana/schema';
import { Select } from '@grafana/ui';

type Props = StandardEditorProps<
  SelectableValue<{ mode: GraphThresholdsStyleMode }>,
  { options: Array<SelectableValue<GraphThresholdsStyleMode>> }
>;

export const ThresholdsStyleEditor = ({ item, value, onChange, id }: Props) => {
  const onChangeCb = useCallback(
    (v: SelectableValue<GraphThresholdsStyleMode>) => {
      onChange({
        mode: v.value,
      });
    },
    [onChange]
  );
  return <Select inputId={id} value={value.mode} options={item.settings?.options ?? []} onChange={onChangeCb} />;
};
