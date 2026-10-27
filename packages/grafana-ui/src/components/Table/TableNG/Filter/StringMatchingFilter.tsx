import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import { useEffect, useMemo, useRef, useState, type KeyboardEventHandler, type RefObject } from 'react';

import { type Field, type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Button } from '../../../Button/Button';
import { ButtonSelect } from '../../../Dropdown/ButtonSelect';
import { FilterInput } from '../../../FilterInput/FilterInput';
import { Stack } from '../../../Layout/Stack/Stack';
import { type FilterOperator, type TableRow } from '../types';

import { FilterList } from './FilterList';
import { FilterPopupFooter, FilterPopupLayout } from './FilterPopupLayout';
import {
  calculateUniqueFieldValues,
  getFieldFilterValue,
  getFilteredOptions,
  operatorSelectableValues,
  valuesToOptions,
} from './utils';

interface Props {
  containerRef: RefObject<HTMLDivElement | null>;
  rows: TableRow[];
  field?: Field;
  filterValue?: Array<SelectableValue<unknown>>;
  searchFilter: string;
  setSearchFilter: (value: string) => void;
  operator: SelectableValue<FilterOperator>;
  setOperator: (item: SelectableValue<FilterOperator>) => void;
  onApplyValues: (values: SelectableValue[]) => void;
  onClear: () => void;
  onClose: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
}

export function StringMatchingFilter({
  containerRef,
  rows,
  field,
  filterValue,
  searchFilter,
  setSearchFilter,
  operator,
  setOperator,
  onApplyValues,
  onClear,
  onClose,
  onKeyDown,
}: Props) {
  const uniqueValues = useMemo(() => calculateUniqueFieldValues(rows, field), [rows, field]);
  const options = useMemo(() => valuesToOptions(uniqueValues), [uniqueValues]);
  const filteredOptions = useMemo(() => getFilteredOptions(options, filterValue), [options, filterValue]);
  const [values, setValues] = useState<SelectableValue[]>(filteredOptions);
  const { selectedRows, totalRows } = useMemo(() => {
    const selectedValues = new Set(values.map((option) => option.value));
    let selectedRows = 0;
    let totalRows = 0;
    for (const row of rows) {
      if (row.__depth !== 0) {
        continue;
      }
      totalRows++;
      if (field && selectedValues.has(getFieldFilterValue(row, field))) {
        selectedRows++;
      }
    }
    return { selectedRows: values.length === 0 ? totalRows : selectedRows, totalRows };
  }, [field, rows, values]);
  const [popupWidth, setPopupWidth] = useState(280);
  const [matchCase, setMatchCase] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const operators = Object.values(operatorSelectableValues());
  const styles = useStyles2(getStyles);

  useEffect(() => {
    // Wait for the closing column menu to restore focus before focusing the filter input.
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <FilterPopupLayout containerRef={containerRef} width={popupWidth} onKeyDown={onKeyDown}>
      <Stack direction="column" gap={1.5}>
        <Stack gap={1}>
          <FilterInput
            ref={inputRef}
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
          onWidthChange={setPopupWidth}
          values={values}
          options={options}
          caseSensitive={matchCase}
          searchFilter={searchFilter}
          operator={operator}
        />

        <FilterPopupFooter
          selectedRows={selectedRows}
          totalRows={totalRows}
          onClear={
            filterValue !== undefined
              ? () => {
                  onClear();
                  onClose();
                }
              : undefined
          }
          onCancel={onClose}
          onApply={() => {
            onApplyValues(values);
            onClose();
          }}
          applyLabel={<Trans i18nKey="grafana-ui.table.filter-popup-apply">Ok</Trans>}
        />
      </Stack>
    </FilterPopupLayout>
  );
}

const getStyles = memoize((theme: GrafanaTheme2) => ({
  buttonSelectOverrides: css({
    fontSize: 12,
    '&:hover, &:focus, &:active': {
      color: theme.colors.text.primary,
      background: 'transparent',
    },
  }),
}));
