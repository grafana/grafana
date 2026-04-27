import type { StandardEditorProps, StatsPickerConfigSettings } from '@grafana/data/field';
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
