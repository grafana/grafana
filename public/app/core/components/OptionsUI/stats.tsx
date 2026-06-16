import { type StandardEditorProps, type StatsPickerConfigSettings } from '@grafana/data';
import { StatsPicker } from '@grafana/ui';

export const StatsPickerEditor = ({
  value,
  onChange,
  item,
  id,
}: StandardEditorProps<string[], StatsPickerConfigSettings>) => {
  return (
    <StatsPicker
      id={id}
      stats={value}
      onChange={onChange}
      allowMultiple={!!item.settings?.allowMultiple}
      defaultStat={item.settings?.defaultStat}
    />
  );
};
