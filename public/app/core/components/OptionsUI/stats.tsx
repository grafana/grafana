import React from 'react';

import { FieldConfigEditorProps, StatsPickerConfigSettings } from '@grafana/data';
import { StatsPicker } from '@grafana/ui';

export const StatsPickerEditor: React.FC<FieldConfigEditorProps<string[], StatsPickerConfigSettings>> = ({
  value,
  onChange,
  item,
  id,
}) => {
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
