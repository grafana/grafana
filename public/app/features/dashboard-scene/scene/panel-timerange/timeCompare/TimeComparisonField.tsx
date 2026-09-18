import { FeatureState } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Combobox, FeatureBadge, Field, Label, Stack } from '@grafana/ui';

import { getCompareOptions } from './options';

interface TimeComparisonFieldProps {
  value: string | undefined;
  onChange: (compareWith: string) => void;
}

export function TimeComparisonField({ value, onChange }: TimeComparisonFieldProps) {
  return (
    <Field
      noMargin
      label={
        <Stack alignItems={'center'} justifyContent={'space-between'}>
          <Label
            description={t(
              'dashboard.panel.time-range-settings.time-window-compare-description',
              'Compare data between two time ranges'
            )}
          >
            <Trans i18nKey="dashboard.panel.time-range-settings.time-window-compare">Time comparison</Trans>
          </Label>
          <FeatureBadge featureState={FeatureState.new} />
        </Stack>
      }
    >
      <Combobox
        options={getCompareOptions()}
        createCustomValue={true}
        value={value ?? ''}
        onChange={(x) => onChange(x.value)}
      />
    </Field>
  );
}
