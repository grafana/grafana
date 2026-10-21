import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type ActionMeta, Field, MultiSelect } from '@grafana/ui';

import { REQUIRED_GROUP_BY_LABELS } from '../../constants';

const DISABLE_GROUPING = '...';
// Only the values are locale-independent and safe to hoist; labels go through t() inside the component so
// they follow language changes.
const BASE_OPTION_VALUES = new Set([...REQUIRED_GROUP_BY_LABELS, DISABLE_GROUPING]);

export interface GroupByFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

// Drops the "Disable" sentinel and puts the required labels back.
function normalize(values: string[]): string[] {
  const result = [...REQUIRED_GROUP_BY_LABELS];
  for (const value of values) {
    if (value !== DISABLE_GROUPING && !result.includes(value)) {
      result.push(value);
    }
  }
  return result;
}

/** Freeform label multi-select for `notificationSettings.groupBy`. `grafana_folder`/`alertname` stay
 * included unless the user picks "Disable (...)", which clears every other value — matches RouteSettings.tsx. */
export function GroupByField({ value, onChange, disabled }: GroupByFieldProps) {
  const baseOptions: Array<SelectableValue<string>> = [
    { label: 'grafana_folder', value: 'grafana_folder' },
    { label: 'alertname', value: 'alertname' },
    { label: t('alerting.group-by-field.disable-option', 'Disable (...)'), value: DISABLE_GROUPING },
  ];
  const options = [
    ...baseOptions,
    ...value.filter((v) => !BASE_OPTION_VALUES.has(v)).map((label) => ({ label, value: label })),
  ];

  const handleChange = (selected: Array<SelectableValue<string>>, meta: ActionMeta) => {
    // react-select types `option` as `{}`, so narrow it before reading the picked value.
    const disablePicked =
      meta.action === 'select-option' &&
      meta.option &&
      'value' in meta.option &&
      meta.option.value === DISABLE_GROUPING;
    const values = selected.map((option) => option.value ?? '');
    onChange(disablePicked ? [DISABLE_GROUPING] : normalize(values));
  };

  const handleCreateOption = (customLabel: string) => onChange(normalize([...value, customLabel]));

  return (
    <Field
      label={t('alerting.group-by-field.label', 'Group by')}
      description={t(
        'alerting.group-by-field.description',
        'Alerts are always grouped by grafana_folder and alertname, plus any additional labels you select. Select "Disable (...)" to send each alert as a separate notification.'
      )}
      disabled={disabled}
      noMargin
    >
      <MultiSelect
        aria-label={t('alerting.group-by-field.aria-label', 'Group by')}
        options={options}
        value={value}
        onChange={handleChange}
        allowCustomValue
        onCreateOption={handleCreateOption}
      />
    </Field>
  );
}
