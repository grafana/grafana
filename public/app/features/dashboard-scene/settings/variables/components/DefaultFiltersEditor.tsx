import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { OPERATORS, type AdHocFilterWithLabels } from '@grafana/scenes';
import {
  Button,
  Combobox,
  type ComboboxOption,
  Field,
  IconButton,
  Input,
  MultiCombobox,
  useStyles2,
} from '@grafana/ui';

const DEFAULT_FILTER_ORIGIN = 'dashboard';

/**
 * Sentinel value for "match everything" default filters, following the convention
 * introduced with the scenes All-value support (values: ['$__all'], valueLabels: ['All']).
 * Only meaningful with the "one of" (=|) operator - any other operator treats the
 * sentinel as a literal value, mirroring isAllValueFilter in @grafana/scenes.
 */
export const ALL_SENTINEL_VALUE = '$__all';
const ALL_SENTINEL_LABEL = 'All';
const ONE_OF_OPERATOR = '=|';

export interface DefaultFiltersEditorProps {
  /** The default (dashboard-origin, non-groupBy) filters currently configured. */
  filters: AdHocFilterWithLabels[];
  onChange: (filters: AdHocFilterWithLabels[]) => void;
  getKeyOptions: () => Promise<Array<SelectableValue<string>>>;
  getValueOptions: (filter: AdHocFilterWithLabels) => Promise<Array<SelectableValue<string>>>;
  getOperatorOptions: () => Array<SelectableValue<string>>;
  allowCustomValue?: boolean;
}

export function createAllFilter(key: string, keyLabel?: string): AdHocFilterWithLabels {
  return {
    key,
    // Only persist a keyLabel when the datasource provides a display label distinct from the raw key
    ...(keyLabel && keyLabel !== key ? { keyLabel } : {}),
    operator: ONE_OF_OPERATOR,
    value: ALL_SENTINEL_VALUE,
    values: [ALL_SENTINEL_VALUE],
    valueLabels: [ALL_SENTINEL_LABEL],
    origin: DEFAULT_FILTER_ORIGIN,
  };
}

// Mirrors isAllValueFilter in @grafana/scenes: the sentinel only means "All" with =|
export function isAllFilter(filter: AdHocFilterWithLabels): boolean {
  if (filter.operator !== ONE_OF_OPERATOR) {
    return false;
  }
  return filter.values ? filter.values.includes(ALL_SENTINEL_VALUE) : filter.value === ALL_SENTINEL_VALUE;
}

function isMultiValueOperator(operator: string): boolean {
  return Boolean(OPERATORS.find((op) => op.value === operator)?.isMulti);
}

function getSelectedValues(filter: AdHocFilterWithLabels): Array<ComboboxOption<string>> {
  const values = filter.values ?? (filter.value !== '' ? [filter.value] : []);
  const labels = filter.valueLabels ?? values;

  return values.map((value, index) => ({ value, label: labels[index] ?? value }));
}

export function DefaultFiltersEditor({
  filters,
  onChange,
  getKeyOptions,
  getValueOptions,
  getOperatorOptions,
  allowCustomValue = true,
}: DefaultFiltersEditorProps) {
  const styles = useStyles2(getStyles);
  const [addingNew, setAddingNew] = useState(false);

  const loadKeyOptions = useCallback(
    async (inputValue: string): Promise<Array<ComboboxOption<string>>> => {
      const options = await getKeyOptions();
      const usedKeys = new Set(filters.map((filter) => filter.key));
      const mapped = options
        .filter((option) => option.value != null && !usedKeys.has(option.value))
        .map((option) => ({ value: option.value!, label: option.label ?? option.value! }));

      if (!inputValue) {
        return mapped;
      }

      const needle = inputValue.toLowerCase();
      return mapped.filter((option) => (option.label ?? option.value).toLowerCase().includes(needle));
    },
    [getKeyOptions, filters]
  );

  const updateFilterAt = useCallback(
    (index: number, filter: AdHocFilterWithLabels) => {
      onChange(filters.map((f, i) => (i === index ? filter : f)));
    },
    [filters, onChange]
  );

  const onValuesChange = useCallback(
    (index: number, items: Array<ComboboxOption<string>>) => {
      const filter = filters[index];
      const wasAll = isAllFilter(filter);
      let selected = items.filter((item) => item.value != null);

      // Selecting All alongside other values resolves in favour of the most recent action:
      // picking All clears the other values; picking a value while All is set drops All.
      const hasAll = filter.operator === ONE_OF_OPERATOR && selected.some((item) => item.value === ALL_SENTINEL_VALUE);
      if (hasAll && !wasAll) {
        updateFilterAt(index, createAllFilter(filter.key, filter.keyLabel));
        return;
      }
      selected = selected.filter((item) => item.value !== ALL_SENTINEL_VALUE);

      if (selected.length === 0) {
        // An empty selection means All for the "one of" operator; other operators keep an
        // empty row for the author to fill in ($__all would be a literal value there)
        const { values: _values, valueLabels: _valueLabels, ...rest } = filter;
        updateFilterAt(
          index,
          filter.operator === ONE_OF_OPERATOR ? createAllFilter(filter.key, filter.keyLabel) : { ...rest, value: '' }
        );
        return;
      }

      if (!isMultiValueOperator(filter.operator) && selected.length > 1) {
        selected = [selected[selected.length - 1]];
      }

      updateFilterAt(index, {
        ...filter,
        value: selected[0].value!,
        values: selected.map((item) => item.value!),
        valueLabels: selected.map((item) => item.label ?? item.value!),
        origin: DEFAULT_FILTER_ORIGIN,
      });
    },
    [filters, updateFilterAt]
  );

  const onOperatorChange = useCallback(
    (index: number, operator: string) => {
      const filter = filters[index];

      // The All sentinel is only meaningful with the "one of" operator - moving off
      // it clears the values, and moving onto it with nothing selected means All
      if (isAllFilter(filter) && operator !== ONE_OF_OPERATOR) {
        const { values: _values, valueLabels: _valueLabels, ...rest } = filter;
        updateFilterAt(index, { ...rest, operator, value: '' });
        return;
      }
      if (operator === ONE_OF_OPERATOR && filter.value === '' && !filter.values?.length) {
        updateFilterAt(index, createAllFilter(filter.key, filter.keyLabel));
        return;
      }

      const update: AdHocFilterWithLabels = { ...filter, operator };

      // Moving to a single-value operator keeps only the first selected value
      if (!isMultiValueOperator(operator) && (filter.values?.length ?? 0) > 1) {
        update.value = filter.values![0];
        update.values = [filter.values![0]];
        update.valueLabels = [filter.valueLabels?.[0] ?? filter.values![0]];
      }

      updateFilterAt(index, update);
    },
    [filters, updateFilterAt]
  );

  const onDisplayNameChange = useCallback(
    (index: number, displayName: string) => {
      const filter = filters[index];
      if (!displayName) {
        // Empty input means no override: the pill falls back to the raw key
        const { keyLabel: _removed, ...rest } = filter;
        updateFilterAt(index, rest);
        return;
      }
      updateFilterAt(index, { ...filter, keyLabel: displayName });
    },
    [filters, updateFilterAt]
  );

  const operatorOptions = getOperatorOptions().map((option) => ({
    value: option.value!,
    label: option.label ?? option.value!,
    description: option.description,
  }));

  // Datasources without multi-value operator support get no All option, so new rows
  // start empty with the equals operator instead of as an All filter
  const createNewFilter = (key: string, keyLabel?: string): AdHocFilterWithLabels =>
    operatorOptions.some((option) => option.value === ONE_OF_OPERATOR)
      ? createAllFilter(key, keyLabel)
      : {
          key,
          ...(keyLabel && keyLabel !== key ? { keyLabel } : {}),
          operator: '=',
          value: '',
          origin: DEFAULT_FILTER_ORIGIN,
        };

  return (
    <Field
      label={t('dashboard-scene.default-filters-editor.label', 'Default filters')}
      description={t(
        'dashboard-scene.default-filters-editor.description',
        'Filters that are pre-selected by default. Set an optional display name to control how the filter key is shown.'
      )}
      noMargin
    >
      <div className={styles.rows} data-testid="default-filters-editor">
        {filters.map((filter, index) => (
          <div className={styles.row} key={filter.key} data-testid={`default-filters-editor-row-${filter.key}`}>
            <Combobox
              width={25}
              data-testid={`default-filters-editor-key-${filter.key}`}
              options={loadKeyOptions}
              value={filter.key}
              onChange={(option) => {
                if (option?.value) {
                  updateFilterAt(index, createNewFilter(option.value, option.label));
                }
              }}
            />
            <Input
              width={20}
              data-testid={`default-filters-editor-display-name-${filter.key}`}
              aria-label={t('dashboard-scene.default-filters-editor.display-name-aria-label', 'Filter display name')}
              placeholder={t('dashboard-scene.default-filters-editor.display-name-placeholder', 'Display name')}
              defaultValue={filter.keyLabel !== filter.key ? filter.keyLabel : ''}
              onBlur={(event) => onDisplayNameChange(index, event.currentTarget.value.trim())}
            />
            <Combobox
              width={12}
              data-testid={`default-filters-editor-operator-${filter.key}`}
              aria-label={t('dashboard-scene.default-filters-editor.operator-aria-label', 'Filter operator')}
              options={operatorOptions}
              value={filter.operator}
              onChange={(option) => {
                if (option?.value) {
                  onOperatorChange(index, option.value);
                }
              }}
            />
            <MultiCombobox<string>
              width="auto"
              minWidth={25}
              maxWidth={50}
              data-testid={`default-filters-editor-values-${filter.key}`}
              placeholder={t('dashboard-scene.default-filters-editor.values-placeholder', 'Values')}
              options={(inputValue) => loadValueOptions(getValueOptions, filter, inputValue)}
              value={getSelectedValues(filter)}
              onChange={(items) => onValuesChange(index, items)}
              createCustomValue={allowCustomValue}
              isClearable
            />
            <IconButton
              name="trash-alt"
              aria-label={t('dashboard-scene.default-filters-editor.remove-aria-label', 'Remove default filter')}
              tooltip={t('dashboard-scene.default-filters-editor.remove-tooltip', 'Remove default filter')}
              onClick={() => onChange(filters.filter((_, i) => i !== index))}
            />
          </div>
        ))}
        {addingNew && (
          <div className={styles.row} data-testid="default-filters-editor-row-new">
            <Combobox
              width={25}
              data-testid="default-filters-editor-key-new"
              options={loadKeyOptions}
              value={null}
              placeholder={t('dashboard-scene.default-filters-editor.field-placeholder', 'Select field')}
              onChange={(option) => {
                if (option?.value) {
                  onChange([...filters, createNewFilter(option.value, option.label)]);
                  setAddingNew(false);
                }
              }}
            />
            <IconButton
              name="times"
              aria-label={t('dashboard-scene.default-filters-editor.cancel-aria-label', 'Cancel adding default filter')}
              tooltip={t('dashboard-scene.default-filters-editor.cancel-tooltip', 'Cancel')}
              onClick={() => setAddingNew(false)}
            />
          </div>
        )}
        <div>
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            disabled={addingNew}
            onClick={() => setAddingNew(true)}
            data-testid="default-filters-editor-add"
          >
            <Trans i18nKey="dashboard-scene.default-filters-editor.add-button">Add default filter</Trans>
          </Button>
        </div>
      </div>
    </Field>
  );
}

async function loadValueOptions(
  getValueOptions: DefaultFiltersEditorProps['getValueOptions'],
  filter: AdHocFilterWithLabels,
  inputValue: string
): Promise<Array<ComboboxOption<string>>> {
  const options = await getValueOptions(filter);
  const mapped = options
    .filter((option) => option.value != null)
    .map((option) => ({ value: option.value!, label: option.label ?? option.value! }));

  const needle = inputValue.toLowerCase();
  const filtered = needle
    ? mapped.filter((option) => (option.label ?? option.value).toLowerCase().includes(needle))
    : mapped;

  // All is only offered for the "one of" operator, matching the scenes combobox behaviour
  if (filter.operator !== ONE_OF_OPERATOR || (needle && !ALL_SENTINEL_LABEL.toLowerCase().includes(needle))) {
    return filtered;
  }

  return [{ value: ALL_SENTINEL_VALUE, label: ALL_SENTINEL_LABEL }, ...filtered];
}

const getStyles = (theme: GrafanaTheme2) => ({
  rows: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  row: css({
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  }),
});
