import { StandardEditorProps, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, RadioButtonGroup } from '@grafana/ui';

import { InputPrefix, NullsThresholdInput } from './NullsThresholdInput';

type Props = StandardEditorProps<boolean | number, { isTime: boolean }>;

export const SpanNullsEditor = ({ value, onChange, item }: Props) => {
  const GAPS_OPTIONS: Array<SelectableValue<boolean | number>> = [
    {
      label: t('timeseries.span-nulls-editor.gaps-options.label-never', 'Never'),
      value: false,
    },
    {
      label: t('timeseries.span-nulls-editor.gaps-options.label-always', 'Always'),
      value: true,
    },
    {
      label: t('timeseries.span-nulls-editor.gaps-options.label-threshold', 'Threshold'),
      value: 3600000, // 1h
    },
  ];
  const isThreshold = typeof value === 'number';
  GAPS_OPTIONS[2].value = isThreshold ? value : 3600000; // 1h

  return (
    <Stack wrap={true}>
      <RadioButtonGroup value={value} options={GAPS_OPTIONS} onChange={onChange} />
      {isThreshold && (
        <NullsThresholdInput
          value={value}
          onChange={onChange}
          inputPrefix={InputPrefix.LessThan}
          isTime={item.settings?.isTime ?? false}
        />
      )}
    </Stack>
  );
};
