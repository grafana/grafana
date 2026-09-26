import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field, MultiSelect } from '@grafana/ui';

// Mirrors amroutes.ts's REQUIRED_FIELDS_IN_GROUPBY/DISABLE_GROUPING/commonGroupByOptions — ported
// since RecipientPicker can't depend on internals code.
const REQUIRED_GROUP_BY_LABELS = ['grafana_folder', 'alertname'];
const DISABLE_GROUPING = '...';
// Only the *values* are locale-independent and safe to hoist — the label goes through t() inside
// the component, since a module-scope t() call runs once at import and never updates on a language change.
const BASE_OPTION_VALUES = new Set([...REQUIRED_GROUP_BY_LABELS, DISABLE_GROUPING]);

export interface GroupByFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

function withRequiredFields(values: string[]): string[] {
  const result = [...REQUIRED_GROUP_BY_LABELS];
  for (const value of values) {
    if (!result.includes(value)) {
      result.push(value);
    }
  }
  return result;
}

/** Freeform label multi-select for `notificationSettings.groupBy`. `grafana_folder`/`alertname` stay
 * included unless the user picks "Disable (...)", which clears every other value — matches RouteSettings.tsx. */
export function GroupByField({ value, onChange, disabled }: GroupByFieldProps) {
  // isFixed is a no-op in this @grafana/ui version (MultiValueRemove ignores it) but kept for forward-compat.
  const baseOptions: Array<SelectableValue<string>> = [
    { label: 'grafana_folder', value: 'grafana_folder', isFixed: true },
    { label: 'alertname', value: 'alertname', isFixed: true },
    { label: t('alerting.group-by-field.disable-option', 'Disable (...)'), value: DISABLE_GROUPING },
  ];
  const options = [
    ...baseOptions,
    ...value.filter((v) => !BASE_OPTION_VALUES.has(v)).map((label) => ({ label, value: label })),
  ];

  const handleChange = (selected: Array<SelectableValue<string>>) => {
    const newValues = selected.map((option) => option.value ?? '');
    const hadDisable = value.includes(DISABLE_GROUPING);
    const nowHasDisable = newValues.includes(DISABLE_GROUPING);

    if (nowHasDisable && !hadDisable) {
      onChange([DISABLE_GROUPING]);
      return;
    }
    if (hadDisable && nowHasDisable && newValues.length > 1) {
      onChange(withRequiredFields(newValues.filter((v) => v !== DISABLE_GROUPING)));
      return;
    }
    if (hadDisable && !nowHasDisable) {
      onChange(REQUIRED_GROUP_BY_LABELS);
      return;
    }
    if (!nowHasDisable) {
      onChange(withRequiredFields(newValues));
      return;
    }
    onChange(newValues);
  };

  const handleCreateOption = (customLabel: string) => {
    const base = value.includes(DISABLE_GROUPING) ? [] : value;
    onChange(withRequiredFields([...base, customLabel]));
  };

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
