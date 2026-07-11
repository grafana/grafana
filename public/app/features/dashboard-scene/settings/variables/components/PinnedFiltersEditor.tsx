import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { type AdHocFilterWithLabels } from '@grafana/scenes';
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

import {
  createMatchAllFilter,
  getPinnedFilterSelectedValues,
  MULTI_VALUE_OPERATOR,
  PINNED_FILTER_ORIGIN,
  SINGLE_VALUE_OPERATOR,
} from '../../../scene/pinned-filters/pinnedFilters';

export interface PinnedFiltersEditorProps {
  /** The pinned (dashboard-origin, non-groupBy) filters currently configured. */
  filters: AdHocFilterWithLabels[];
  onChange: (filters: AdHocFilterWithLabels[]) => void;
  getKeyOptions: () => Promise<Array<SelectableValue<string>>>;
  getValueOptions: (filter: AdHocFilterWithLabels) => Promise<Array<SelectableValue<string>>>;
  supportsMultiValueOperators?: boolean;
  allowCustomValue?: boolean;
}

export function PinnedFiltersEditor({
  filters,
  onChange,
  getKeyOptions,
  getValueOptions,
  supportsMultiValueOperators,
  allowCustomValue = true,
}: PinnedFiltersEditorProps) {
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

  const onDefaultValuesChange = useCallback(
    (index: number, items: Array<ComboboxOption<string>>) => {
      const filter = filters[index];
      const values = items.filter((item) => item.value != null).map((item) => item.value!);

      if (values.length === 0) {
        updateFilterAt(index, createMatchAllFilter(filter.key, filter.keyLabel));
        return;
      }

      const valueLabels = items.filter((item) => item.value != null).map((item) => item.label ?? item.value!);

      updateFilterAt(index, {
        key: filter.key,
        keyLabel: filter.keyLabel || filter.key,
        operator: supportsMultiValueOperators ? MULTI_VALUE_OPERATOR : SINGLE_VALUE_OPERATOR,
        value: values[0],
        values,
        valueLabels,
        origin: PINNED_FILTER_ORIGIN,
      });
    },
    [filters, supportsMultiValueOperators, updateFilterAt]
  );

  const onLabelChange = useCallback(
    (index: number, label: string) => {
      const filter = filters[index];
      updateFilterAt(index, { ...filter, keyLabel: label || filter.key });
    },
    [filters, updateFilterAt]
  );

  return (
    <Field
      label={t('dashboard-scene.pinned-filters-editor.label', 'Pinned filters')}
      description={t(
        'dashboard-scene.pinned-filters-editor.description',
        "Pinned filters are always visible at the top of the dashboard. Viewers can change their values but can't remove them."
      )}
      noMargin
    >
      <div className={styles.rows} data-testid="pinned-filters-editor">
        {filters.map((filter, index) => (
          <div className={styles.row} key={filter.key} data-testid={`pinned-filters-editor-row-${filter.key}`}>
            <Combobox
              width={25}
              data-testid={`pinned-filters-editor-key-${filter.key}`}
              options={loadKeyOptions}
              value={filter.key}
              onChange={(option) => {
                if (option?.value) {
                  updateFilterAt(index, createMatchAllFilter(option.value, undefined));
                }
              }}
            />
            <Input
              width={20}
              aria-label={t('dashboard-scene.pinned-filters-editor.label-aria-label', 'Pinned filter label')}
              placeholder={t('dashboard-scene.pinned-filters-editor.label-placeholder', 'Label (optional)')}
              defaultValue={filter.keyLabel !== filter.key ? filter.keyLabel : ''}
              onBlur={(event) => onLabelChange(index, event.currentTarget.value.trim())}
            />
            <MultiCombobox<string>
              width="auto"
              minWidth={25}
              maxWidth={50}
              data-testid={`pinned-filters-editor-values-${filter.key}`}
              placeholder={t('dashboard-scene.pinned-filters-editor.values-placeholder', 'Default values (optional)')}
              options={(inputValue) => loadValueOptions(getValueOptions, filter, inputValue)}
              value={getPinnedFilterSelectedValues(filter)}
              onChange={(items) => onDefaultValuesChange(index, items)}
              createCustomValue={allowCustomValue}
              isClearable
            />
            <IconButton
              name="trash-alt"
              aria-label={t('dashboard-scene.pinned-filters-editor.remove-aria-label', 'Remove pinned filter')}
              tooltip={t('dashboard-scene.pinned-filters-editor.remove-tooltip', 'Remove pinned filter')}
              onClick={() => onChange(filters.filter((_, i) => i !== index))}
            />
          </div>
        ))}
        {addingNew && (
          <div className={styles.row} data-testid="pinned-filters-editor-row-new">
            <Combobox
              width={25}
              data-testid="pinned-filters-editor-key-new"
              options={loadKeyOptions}
              value={null}
              placeholder={t('dashboard-scene.pinned-filters-editor.field-placeholder', 'Select field')}
              onChange={(option) => {
                if (option?.value) {
                  onChange([...filters, createMatchAllFilter(option.value, undefined)]);
                  setAddingNew(false);
                }
              }}
            />
            <IconButton
              name="times"
              aria-label={t('dashboard-scene.pinned-filters-editor.cancel-aria-label', 'Cancel adding pinned filter')}
              tooltip={t('dashboard-scene.pinned-filters-editor.cancel-tooltip', 'Cancel')}
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
            data-testid="pinned-filters-editor-add"
          >
            <Trans i18nKey="dashboard-scene.pinned-filters-editor.add-button">Add pinned filter</Trans>
          </Button>
        </div>
      </div>
    </Field>
  );
}

async function loadValueOptions(
  getValueOptions: PinnedFiltersEditorProps['getValueOptions'],
  filter: AdHocFilterWithLabels,
  inputValue: string
): Promise<Array<ComboboxOption<string>>> {
  const options = await getValueOptions(filter);
  const mapped = options
    .filter((option) => option.value != null)
    .map((option) => ({ value: option.value!, label: option.label ?? option.value! }));

  if (!inputValue) {
    return mapped;
  }

  const needle = inputValue.toLowerCase();
  return mapped.filter((option) => (option.label ?? option.value).toLowerCase().includes(needle));
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
    gap: theme.spacing(1),
  }),
});
