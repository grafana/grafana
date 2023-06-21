import React from 'react';

import { FieldConfigEditorProps, StatsPickerConfigSettings } from '@grafana/data';
import { StatsPicker } from '@grafana/ui';

export const StatsPickerEditor = ({
  value,
  onChange,
  item,
  id,
}: FieldConfigEditorProps<string[], StatsPickerConfigSettings>) => {
  return (
    <StatsPicker
      stats={value}
      onChange={onChange}
      allowMultiple={!!item.settings?.allowMultiple}
      defaultStat={item.settings?.defaultStat}
      inputId={id}
    />
  );
};
