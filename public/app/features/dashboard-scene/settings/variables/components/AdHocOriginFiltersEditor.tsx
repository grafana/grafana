import { css } from '@emotion/css';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react';

import { generateUUID, type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { OPERATORS, type AdHocFilterWithLabels, type AdHocFiltersController } from '@grafana/scenes';
import {
  Button,
  Combobox,
  Field,
  IconButton,
  Input,
  MultiCombobox,
  useStyles2,
  type ComboboxOption,
} from '@grafana/ui';

const ORIGIN_DASHBOARD = 'dashboard';
const DEFAULT_OPERATOR = '=';

export interface AdHocOriginFiltersEditorProps {
  controller: AdHocFiltersController;
}

interface DefaultFilterRow {
  id: string;
  filter: AdHocFilterWithLabels;
}

export function AdHocOriginFiltersEditor({ controller }: AdHocOriginFiltersEditorProps): ReactElement {
  const styles = useStyles2(getStyles);
  const idPrefix = useId();
  const { filters, allowCustomValue } = controller.useState();

  const [rows, setRows] = useState<DefaultFilterRow[]>(() =>
    filters.map((filter) => ({ id: generateUUID(), filter: normalizeKeyLabel(filter) }))
  );

  // track id of a newly added row for auto-focus
  const autoFocusIdRef = useRef<string | null>(null);
  useEffect(() => {
    autoFocusIdRef.current = null;
  });

  const operatorOptions = useMemo(() => toComboboxOptions(controller.getOperators()), [controller]);

  // rows are the source of truth for the UI, incomplete ones are kept local until they are
  // complete enough to be applied as a default filter
  const commitRows = useCallback(
    (nextRows: DefaultFilterRow[]) => {
      setRows(nextRows);
      controller.updateFilters?.(nextRows.map((row) => row.filter).filter(isCompleteDefaultFilter));
    },
    [controller]
  );

  const onAddRow = () => {
    const id = generateUUID();
    autoFocusIdRef.current = id;

    setRows((currentRows) => [
      ...currentRows,
      { id, filter: { key: '', operator: DEFAULT_OPERATOR, value: '', origin: ORIGIN_DASHBOARD } },
    ]);
  };

  const onChangeRow = (id: string, update: Partial<AdHocFilterWithLabels>) => {
    commitRows(rows.map((row) => (row.id === id ? { ...row, filter: { ...row.filter, ...update } } : row)));
  };

  const onRemoveRow = (id: string) => {
    commitRows(rows.filter((row) => row.id !== id));
  };

  return (
    <Field
      label={t('dashboard-scene.adhoc-origin-filters-editor.label', 'Default filters')}
      description={t(
        'dashboard-scene.adhoc-origin-filters-editor.description',
        'Filters that are pre-selected by default.'
      )}
      noMargin
    >
      <div className={styles.wrapper}>
        {rows.map((row, index) => (
          <DefaultFilterRowEditor
            key={row.id}
            idPrefix={`${idPrefix}-${index}`}
            index={index}
            filter={row.filter}
            controller={controller}
            operatorOptions={operatorOptions}
            allowCustomValue={allowCustomValue ?? true}
            autoFocus={row.id === autoFocusIdRef.current}
            onChange={(update) => onChangeRow(row.id, update)}
            onRemove={() => onRemoveRow(row.id)}
          />
        ))}

        <div>
          <Button icon="plus" variant="secondary" size="sm" onClick={onAddRow} data-testid="default-filters-add-button">
            <Trans i18nKey="dashboard-scene.adhoc-origin-filters-editor.add-filter">Add default filter</Trans>
          </Button>
        </div>
      </div>
    </Field>
  );
}

interface DefaultFilterRowEditorProps {
  idPrefix: string;
  index: number;
  filter: AdHocFilterWithLabels;
  controller: AdHocFiltersController;
  operatorOptions: Array<ComboboxOption<string>>;
  allowCustomValue: boolean;
  autoFocus: boolean;
  onChange: (update: Partial<AdHocFilterWithLabels>) => void;
  onRemove: () => void;
}

function DefaultFilterRowEditor({
  idPrefix,
  index,
  filter,
  controller,
  operatorOptions,
  allowCustomValue,
  autoFocus,
  onChange,
  onRemove,
}: DefaultFilterRowEditorProps): ReactElement {
  const styles = useStyles2(getStyles);
  const isMultiValue = isMultiValueOperator(filter.operator);
  const rowNumber = index + 1;

  const loadKeys = useCallback(
    async (inputValue: string) => {
      const keys = await controller.getKeys(filter.key || null);
      return filterOptionsByInput(toComboboxOptions(keys), inputValue);
    },
    [controller, filter.key]
  );

  const loadValues = useCallback(
    async (inputValue: string) => {
      if (!filter.key) {
        return [];
      }
      const values = await controller.getValuesFor(filter);
      return filterOptionsByInput(toComboboxOptions(values), inputValue);
    },
    [controller, filter]
  );

  return (
    <div className={styles.row} data-testid="default-filter-row">
      <div className={styles.keyCell}>
        {/* the controls are labelled for screen readers only, the visible label is on the Field */}
        <label htmlFor={`${idPrefix}-key`} className="sr-only">
          {t('dashboard-scene.default-filter-row.label-key', 'Default filter {{rowNumber}} key', { rowNumber })}
        </label>
        <Combobox
          id={`${idPrefix}-key`}
          placeholder={t('dashboard-scene.default-filter-row.placeholder-key', 'Key')}
          options={loadKeys}
          value={filter.key || null}
          createCustomValue={allowCustomValue}
          autoFocus={autoFocus}
          onChange={(option) => onChange(getKeyChangeUpdate(option))}
        />
      </div>

      <div className={styles.keyLabelCell}>
        <label htmlFor={`${idPrefix}-key-label`} className="sr-only">
          {t('dashboard-scene.default-filter-row.label-key-label', 'Default filter {{rowNumber}} label', {
            rowNumber,
          })}
        </label>
        <Input
          id={`${idPrefix}-key-label`}
          placeholder={t('dashboard-scene.default-filter-row.placeholder-key-label', 'Label')}
          value={filter.keyLabel ?? ''}
          onChange={(event) => onChange({ keyLabel: event.currentTarget.value || undefined })}
        />
      </div>

      {/* narrow input, the dropdown grows to fit the operator descriptions on its own */}
      <div className={styles.operatorCell}>
        <label htmlFor={`${idPrefix}-operator`} className="sr-only">
          {t('dashboard-scene.default-filter-row.label-operator', 'Default filter {{rowNumber}} operator', {
            rowNumber,
          })}
        </label>
        <Combobox
          id={`${idPrefix}-operator`}
          options={operatorOptions}
          value={filter.operator}
          onChange={(option) => onChange(getOperatorChangeUpdate(filter, option.value))}
        />
      </div>

      <div className={styles.valueCell}>
        <label htmlFor={`${idPrefix}-value`} className="sr-only">
          {isMultiValue
            ? t('dashboard-scene.default-filter-row.label-values', 'Default filter {{rowNumber}} values', {
                rowNumber,
              })
            : t('dashboard-scene.default-filter-row.label-value', 'Default filter {{rowNumber}} value', {
                rowNumber,
              })}
        </label>
        {isMultiValue ? (
          <MultiCombobox
            id={`${idPrefix}-value`}
            placeholder={t('dashboard-scene.default-filter-row.placeholder-values', 'Values')}
            options={loadValues}
            value={toMultiValueOptions(filter)}
            createCustomValue={allowCustomValue}
            disabled={!filter.key}
            isClearable
            onChange={(options) => onChange(getMultiValueChangeUpdate(options))}
          />
        ) : (
          <Combobox
            id={`${idPrefix}-value`}
            placeholder={t('dashboard-scene.default-filter-row.placeholder-value', 'Value')}
            options={loadValues}
            value={filter.value ? { value: filter.value, label: filter.valueLabels?.[0] ?? filter.value } : null}
            createCustomValue={allowCustomValue}
            disabled={!filter.key}
            isClearable
            onChange={(option) => onChange(getValueChangeUpdate(option))}
          />
        )}
      </div>

      <IconButton
        name="trash-alt"
        variant="destructive"
        onClick={onRemove}
        tooltip={t('dashboard-scene.default-filter-row.tooltip-remove', 'Remove default filter {{rowNumber}}', {
          rowNumber,
        })}
        tooltipPlacement="top"
      />
    </div>
  );
}

function isMultiValueOperator(operator: string): boolean {
  return Boolean(OPERATORS.find((o) => o.value === operator)?.isMulti);
}

/**
 * A row is only applied as a default filter once it holds a key and at least one value, so that
 * half filled rows are never written to the variable or saved to the dashboard.
 */
function isCompleteDefaultFilter(filter: AdHocFilterWithLabels): boolean {
  if (!filter.key || !filter.operator) {
    return false;
  }

  return isMultiValueOperator(filter.operator) ? Boolean(filter.values?.length) : Boolean(filter.value);
}

/**
 * Drops a key label that only repeats the key, so the label input is shown as empty and the user
 * can tell when a data source actually provides a display label.
 */
function normalizeKeyLabel(filter: AdHocFilterWithLabels): AdHocFilterWithLabels {
  if (filter.keyLabel && filter.keyLabel === filter.key) {
    const { keyLabel, ...rest } = filter;
    return rest;
  }

  return filter;
}

function getKeyChangeUpdate(option: ComboboxOption<string> | null): Partial<AdHocFilterWithLabels> {
  if (!option) {
    return { key: '', keyLabel: undefined };
  }

  return {
    key: option.value,
    keyLabel: option.label && option.label !== option.value ? option.label : undefined,
  };
}

function getOperatorChangeUpdate(filter: AdHocFilterWithLabels, operator: string): Partial<AdHocFilterWithLabels> {
  const wasMultiValue = isMultiValueOperator(filter.operator);
  const isMultiValue = isMultiValueOperator(operator);

  if (wasMultiValue && !isMultiValue) {
    const value = filter.values?.[0] ?? '';
    return { operator, value, valueLabels: value ? [filter.valueLabels?.[0] ?? value] : [], values: undefined };
  }

  if (!wasMultiValue && isMultiValue) {
    return {
      operator,
      values: filter.value ? [filter.value] : [],
      valueLabels: filter.value ? [filter.valueLabels?.[0] ?? filter.value] : [],
    };
  }

  return { operator };
}

function getValueChangeUpdate(option: ComboboxOption<string> | null): Partial<AdHocFilterWithLabels> {
  if (!option) {
    return { value: '', valueLabels: undefined };
  }

  return { value: option.value, valueLabels: [option.label ?? option.value] };
}

function getMultiValueChangeUpdate(options: Array<ComboboxOption<string>>): Partial<AdHocFilterWithLabels> {
  const values = options.map((option) => option.value);

  return {
    values,
    valueLabels: options.map((option) => option.label ?? option.value),
    value: values[0] ?? '',
  };
}

function toMultiValueOptions(filter: AdHocFilterWithLabels): Array<ComboboxOption<string>> {
  return (filter.values ?? []).map((value, index) => ({ value, label: filter.valueLabels?.[index] ?? value }));
}

/**
 * Combobox sizes its dropdown rows by testing whether the `description` key is present, not whether
 * it holds anything, so a `description: undefined` would give every option the taller row height.
 */
export function toComboboxOptions(options: Array<SelectableValue<string>>): Array<ComboboxOption<string>> {
  const comboboxOptions: Array<ComboboxOption<string>> = [];

  for (const option of options) {
    if (option.value == null) {
      continue;
    }

    comboboxOptions.push({
      value: option.value,
      label: option.label ?? option.value,
      ...(option.description ? { description: option.description } : {}),
    });
  }

  return comboboxOptions;
}

/**
 * Keys and values are fetched unfiltered from the data source, so narrowing down the dropdown as
 * the user types has to happen here.
 */
function filterOptionsByInput(
  options: Array<ComboboxOption<string>>,
  inputValue: string
): Array<ComboboxOption<string>> {
  const search = inputValue.trim().toLowerCase();

  if (!search) {
    return options;
  }

  return options.filter((option) => (option.label ?? option.value).toLowerCase().includes(search));
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    alignItems: 'flex-start',
  }),
  row: css({
    display: 'flex',
    gap: theme.spacing(0.5),
    alignItems: 'center',
    width: '100%',
  }),
  keyCell: css({
    flex: '1 1 0',
    minWidth: 0,
  }),
  keyLabelCell: css({
    flex: '1 1 0',
    minWidth: 0,
  }),
  operatorCell: css({
    flex: '0 0 auto',
    width: theme.spacing(8),
  }),
  valueCell: css({
    flex: '1.4 1 0',
    minWidth: 0,
  }),
});
