import { t } from '@grafana/i18n';
import { Field, MultiSelect } from '@grafana/ui';

const SUGGESTED_GROUP_BY_LABELS = ['grafana_folder', 'alertname'];

export interface GroupByFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

/** Freeform label multi-select for `notificationSettings.groupBy`. Suggests but doesn't force
 * grafana_folder/alertname — unlike the internal amroutes.ts REQUIRED_FIELDS_IN_GROUPBY it visually mirrors. */
export function GroupByField({ value, onChange, disabled }: GroupByFieldProps) {
  const options = Array.from(new Set([...SUGGESTED_GROUP_BY_LABELS, ...value])).map((label) => ({
    label,
    value: label,
  }));

  return (
    <Field
      label={t('alerting.group-by-field.label', 'Group by')}
      description={t(
        'alerting.group-by-field.description',
        'Group alert instances that have these labels in common into a single notification.'
      )}
      disabled={disabled}
      noMargin
    >
      <MultiSelect
        aria-label={t('alerting.group-by-field.aria-label', 'Group by')}
        options={options}
        value={value}
        onChange={(selected) => onChange(selected.map((option) => option.value ?? ''))}
        allowCustomValue
        onCreateOption={(customLabel) => onChange([...value, customLabel])}
      />
    </Field>
  );
}
