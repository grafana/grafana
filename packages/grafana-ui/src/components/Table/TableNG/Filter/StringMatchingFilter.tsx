import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import { useMemo, useState, type KeyboardEventHandler, type RefObject } from 'react';

import { type Field, type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Button } from '../../../Button/Button';
import { ButtonSelect } from '../../../Dropdown/ButtonSelect';
import { FilterInput } from '../../../FilterInput/FilterInput';
import { Label } from '../../../Forms/Label';
import { Stack } from '../../../Layout/Stack/Stack';
import { type FilterOperator, type TableRow } from '../types';
import { getDisplayName } from '../utils';

import { FilterList } from './FilterList';
import { FilterMissingValues, FilterPopupFooter, FilterPopupLayout } from './FilterPopupLayout';
import { useFilterInputFocus } from './useFilterInputFocus';
import {
  calculateUniqueFieldValues,
  getFieldFilterValue,
  getFilteredOptions,
  operatorSelectableValues,
  valuesToOptions,
} from './utils';

interface Props {
  containerRef: RefObject<HTMLDivElement | null>;
  rangeFiltersEnabled?: boolean;
  rows: TableRow[];
  field?: Field;
  filterValue?: Array<SelectableValue<unknown>>;
  searchFilter: string;
  setSearchFilter: (value: string) => void;
  operator: SelectableValue<FilterOperator>;
  setOperator: (item: SelectableValue<FilterOperator>) => void;
  onApplyValues: (values: SelectableValue[], includeMissing?: boolean) => void;
  includeMissing?: boolean;
  onClear: () => void;
  onClose: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
}

export function StringMatchingFilter({
  containerRef,
  rangeFiltersEnabled,
  rows,
  field,
  filterValue,
  includeMissing: appliedIncludeMissing,
  searchFilter,
  setSearchFilter,
  operator,
  setOperator,
  onApplyValues,
  onClear,
  onClose,
  onKeyDown,
}: Props) {
  const newFeaturesEnabled = rangeFiltersEnabled === true;
  const optionRows = useMemo(
    () => (newFeaturesEnabled ? rows.filter((row) => !field || field.values[row.__index] != null) : rows),
    [newFeaturesEnabled, rows, field]
  );
  const uniqueValues = useMemo(() => calculateUniqueFieldValues(optionRows, field), [optionRows, field]);
  const options = useMemo(() => valuesToOptions(uniqueValues), [uniqueValues]);
  const filteredOptions = useMemo(() => getFilteredOptions(options, filterValue), [options, filterValue]);
  const [includeMissing, setIncludeMissing] = useState(
    () =>
      newFeaturesEnabled &&
      (appliedIncludeMissing ??
        (filterValue !== undefined &&
          rows.some(
            (row) =>
              field &&
              field.values[row.__index] == null &&
              filterValue.some((option) => option.value === getFieldFilterValue(row, field))
          )))
  );
  const [values, setValues] = useState<SelectableValue[]>(filteredOptions);
  const { selectedRows, totalRows } = useMemo(() => {
    if (!newFeaturesEnabled) {
      return { selectedRows: 0, totalRows: 0 };
    }
    const selectedValues = new Set(values.map((option) => option.value));
    let selectedRows = 0;
    let totalRows = 0;
    for (const row of rows) {
      if (row.__depth !== 0) {
        continue;
      }
      totalRows++;
      if (
        field &&
        (field.values[row.__index] == null ? includeMissing : selectedValues.has(getFieldFilterValue(row, field)))
      ) {
        selectedRows++;
      }
    }
    return { selectedRows: values.length === 0 && !includeMissing ? totalRows : selectedRows, totalRows };
  }, [newFeaturesEnabled, field, rows, values, includeMissing]);
  const [popupWidth, setPopupWidth] = useState(280);
  const [matchCase, setMatchCase] = useState(false);
  const inputRef = useFilterInputFocus();
  const operators = Object.values(operatorSelectableValues());
  const styles = useStyles2(getStyles);
  const applyFilter = () => {
    if (newFeaturesEnabled) {
      onApplyValues(values, includeMissing);
    } else {
      onApplyValues(values);
    }
    onClose();
  };
  const clearFilter = () => {
    onClear();
    onClose();
  };

  return (
    <FilterPopupLayout containerRef={containerRef} width={newFeaturesEnabled ? popupWidth : 320} onKeyDown={onKeyDown}>
      <Stack direction="column" gap={1.5}>
        {!newFeaturesEnabled && field && (
          <Stack alignItems="center">
            <Label className={styles.label}>{getDisplayName(field)}</Label>
          </Stack>
        )}
        <Stack gap={1}>
          <FilterInput
            ref={inputRef}
            hideClearText={newFeaturesEnabled}
            placeholder={t('grafana-ui.table.filter-popup-input-placeholder', 'Filter values')}
            title={t('grafana-ui.table.filter-popup-input-placeholder', 'Filter values')}
            onChange={setSearchFilter}
            value={searchFilter}
            suffix={
              <ButtonSelect
                className={styles.buttonSelectOverrides}
                options={operators}
                onChange={setOperator}
                value={operator}
                tooltip={operator.description}
                narrow
                root={containerRef.current ?? undefined}
              />
            }
          />
          <Button
            tooltip={t('grafana-ui.table.filter-popup-aria-label-match-case', 'Match case')}
            variant={matchCase ? 'primary' : 'secondary'}
            onClick={() => setMatchCase((s) => !s)}
            aria-pressed={matchCase}
            icon={'text-fields'}
          />
        </Stack>

        <FilterList
          onChange={setValues}
          onWidthChange={newFeaturesEnabled ? setPopupWidth : undefined}
          values={values}
          options={options}
          caseSensitive={matchCase}
          searchFilter={searchFilter}
          operator={operator}
        />

        {newFeaturesEnabled ? (
          <>
            <FilterMissingValues value={includeMissing} onChange={setIncludeMissing} />
            <FilterPopupFooter
              selectedRows={selectedRows}
              totalRows={totalRows}
              onClear={filterValue !== undefined ? clearFilter : undefined}
              onCancel={onClose}
              onApply={applyFilter}
              applyLabel={<Trans i18nKey="grafana-ui.table.range.apply">Apply</Trans>}
            />
          </>
        ) : (
          <Stack justifyContent="end" direction="row-reverse">
            <Button size="sm" onClick={applyFilter}>
              <Trans i18nKey="grafana-ui.table.filter-popup-apply">Ok</Trans>
            </Button>
            <Button size="sm" variant="secondary" onClick={onClose}>
              <Trans i18nKey="grafana-ui.table.filter-popup-cancel">Cancel</Trans>
            </Button>
            {filterValue !== undefined && (
              <Button fill="text" size="sm" onClick={clearFilter}>
                <Trans i18nKey="grafana-ui.table.filter-popup-clear">Clear filter</Trans>
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </FilterPopupLayout>
  );
}

const getStyles = memoize((theme: GrafanaTheme2) => ({
  label: css({
    marginBottom: 0,
  }),
  buttonSelectOverrides: css({
    fontSize: 12,
    '&:hover, &:focus, &:active': {
      color: theme.colors.text.primary,
      background: 'transparent',
    },
  }),
}));
