import React from 'react';
import { FieldConfigEditorProps, StatsPickerConfigSettings } from '@grafana/data';
import { StatsPicker } from '../StatsPicker/StatsPicker';

export const StatsPickerEditor: React.FC<FieldConfigEditorProps<string[], StatsPickerConfigSettings>> = ({
  value,
  onChange,
  item,
}) => {
  return (
    <StatsPicker
      stats={value}
      onChange={onChange}
      allowMultiple={!!item.settings?.allowMultiple}
      defaultStat={item.settings?.defaultStat}
    />
  );
};
