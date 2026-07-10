import { css } from '@emotion/css';
import { useCallback } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type AdHocFiltersVariable, type AdHocFilterWithLabels, ControlsLabel } from '@grafana/scenes';
import { Combobox, type ComboboxOption, IconButton, MultiCombobox, useStyles2 } from '@grafana/ui';

import { commitPinnedFilterValues, getPinnedFilterSelectedValues } from './pinnedFilters';

export interface PinnedFilterControlProps {
  variable: AdHocFiltersVariable;
  filter: AdHocFilterWithLabels;
  labelClassName?: string;
}

export function PinnedFilterControl({ variable, filter, labelClassName }: PinnedFilterControlProps) {
  const styles = useStyles2(getStyles);
  const { supportsMultiValueOperators, allowCustomValue, readOnly } = variable.useState();

  const label = filter.keyLabel || filter.key;
  const inputId = `pinned-filter-${variable.state.name}-${filter.key}`;
  const selected = getPinnedFilterSelectedValues(filter);
  const disabled = Boolean(readOnly) || Boolean(filter.nonApplicable);

  const loadOptions = useCallback(
    async (inputValue: string): Promise<Array<ComboboxOption<string>>> => {
      const options = await variable._getValuesFor(filter);
      const mapped = options
        .filter((option) => option.value != null)
        .map((option) => ({ value: option.value!, label: option.label ?? option.value! }));

      if (!inputValue) {
        return mapped;
      }

      const needle = inputValue.toLowerCase();
      return mapped.filter((option) => (option.label ?? option.value).toLowerCase().includes(needle));
    },
    [variable, filter]
  );

  const onChangeMulti = useCallback(
    (items: Array<ComboboxOption<string>>) => {
      commitPinnedFilterValues(variable, filter, items);
    },
    [variable, filter]
  );

  const onChangeSingle = useCallback(
    (item: ComboboxOption<string> | null) => {
      commitPinnedFilterValues(variable, filter, item ? [item] : []);
    },
    [variable, filter]
  );

  const restoreButton =
    filter.restorable && !readOnly ? (
      <IconButton
        name="history"
        size="sm"
        className={styles.restoreButton}
        onClick={() => variable.restoreOriginalFilter(filter)}
        tooltip={t(
          'dashboard-scene.pinned-filter-control.restore-tooltip',
          'Restore the value set by this dashboard.'
        )}
        aria-label={t(
          'dashboard-scene.pinned-filter-control.restore-aria-label',
          'Restore pinned filter {{label}} to its default value',
          { label }
        )}
      />
    ) : undefined;

  return (
    <div className={styles.container} data-testid={`pinned-filter-${filter.key}`}>
      <ControlsLabel htmlFor={inputId} label={label} className={labelClassName} suffix={restoreButton} />
      {supportsMultiValueOperators ? (
        <MultiCombobox
          id={inputId}
          data-testid={`pinned-filter-value-${filter.key}`}
          options={loadOptions}
          value={selected}
          onChange={onChangeMulti}
          placeholder={t('dashboard-scene.pinned-filter-control.placeholder-all', 'All')}
          createCustomValue={allowCustomValue ?? true}
          isClearable
          disabled={disabled}
          minWidth={16}
          maxWidth={60}
        />
      ) : (
        <Combobox
          id={inputId}
          data-testid={`pinned-filter-value-${filter.key}`}
          options={loadOptions}
          value={selected[0]?.value ?? null}
          onChange={onChangeSingle}
          placeholder={t('dashboard-scene.pinned-filter-control.placeholder-all', 'All')}
          createCustomValue={allowCustomValue ?? true}
          isClearable
          disabled={disabled}
          minWidth={16}
          maxWidth={60}
        />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
    // No border for second element (inputs) as label and input border is shared
    '> :nth-child(2)': css({
      borderTopLeftRadius: 'unset',
      borderBottomLeftRadius: 'unset',
    }),
  }),
  restoreButton: css({
    marginLeft: theme.spacing(0.5),
  }),
});
