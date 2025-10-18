import { StandardEditorProps, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, RadioButtonGroup } from '@grafana/ui';

import { InputPrefix, NullsThresholdInput } from './NullsThresholdInput';

type Props = StandardEditorProps<boolean | number, { isTime: boolean }>;

export const InsertNullsEditor = ({ value, onChange, item }: Props) => {
  const DISCONNECT_OPTIONS: Array<SelectableValue<boolean | number>> = [
    {
      label: t('timeseries.insert-nulls-editor.disconnect-options.label-never', 'Never'),
      value: false,
    },
    {
      label: t('timeseries.insert-nulls-editor.disconnect-options.label-threshold', 'Threshold'),
      value: 3600000, // 1h
    },
  ];
  const isThreshold = typeof value === 'number';
  DISCONNECT_OPTIONS[1].value = isThreshold ? value : 3600000; // 1h

  return (
    <Stack>
      <RadioButtonGroup value={value} options={DISCONNECT_OPTIONS} onChange={onChange} />
      {isThreshold && (
        <NullsThresholdInput
          value={value}
          onChange={onChange}
          inputPrefix={InputPrefix.GreaterThan}
          isTime={item.settings?.isTime ?? false}
        />
      )}
    </Stack>
  );
};
