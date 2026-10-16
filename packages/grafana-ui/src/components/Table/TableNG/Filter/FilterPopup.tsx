import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FieldType, type Field, type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Button } from '../../../Button/Button';
import { ButtonSelect } from '../../../Dropdown/ButtonSelect';
import { FilterInput } from '../../../FilterInput/FilterInput';
import { Stack } from '../../../Layout/Stack/Stack';
import { type FilterOperator, type TableRow } from '../types';

import { FilterList } from './FilterList';
import { FilterPopupFooter, FilterPopupLayout } from './FilterPopupLayout';
import { RangeFilter } from './RangeFilter';
import {
  calculateUniqueFieldValues,
  getFieldFilterValue,
  getFilteredOptions,
  operatorSelectableValues,
  valuesToOptions,
} from './utils';

export interface FilterPopupProps {
  stateKey?: string;
  onApplyValues: (values: SelectableValue[]) => void;
  onApplyRange?: (range: { min?: number; max?: number; includeMissing: boolean }) => void;
  onClear: () => void;
  timeZone?: string;
  range?: { min?: number; max?: number; includeMissing: boolean };
  rows: TableRow[];
  filterValue?: Array<SelectableValue<unknown>>;
  onClose: () => void;
  field?: Field;
  searchFilter: string;
  setSearchFilter: (value: string) => void;
  operator: SelectableValue<FilterOperator>;
  setOperator: (item: SelectableValue<FilterOperator>) => void;
  buttonElement: HTMLButtonElement | null;
}

export const FilterPopup = memo((props: FilterPopupProps) => <FilterPopupEditor key={props.stateKey} {...props} />);

const FilterPopupEditor = memo(
  ({
    onApplyValues,
    onApplyRange,
    onClear,
    range,
    timeZone,
    rows,
    filterValue,
    onClose,
    field,
    searchFilter,
    setSearchFilter,
    operator,
    setOperator,
    buttonElement,
  }: FilterPopupProps) => {
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
    const [popupWidth, setPopupWidth] = useState(240);
    const [matchCase, setMatchCase] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const pointerStartedInside = useRef(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const operators = Object.values(operatorSelectableValues());

    // focus the input on mount. autoFocus prop doesn't work on FilterInput, maybe due to the forwarded ref
    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, []);

    useEffect(() => {
      function handleEscape(e: KeyboardEvent) {
        if (e.key === 'Escape') {
          onClose();
          buttonElement?.focus();
        }
      }
      document.addEventListener('keyup', handleEscape);

      return () => {
        document.removeEventListener('keyup', handleEscape);
      };
    }, [onClose, buttonElement]);

    const onFilter = useCallback(() => {
      onApplyValues(values);
      onClose();
    }, [values, onClose, onApplyValues]);

    const onClearFilter = useCallback(() => {
      onClear();
      onClose();
    }, [onClose, onClear]);

    // we can't directly use ClickOutsideWrapper here because the click and keyup
    // events are complex and need to be handled with care to avoid conflicts
    useEffect(() => {
      const onPointerDown = (event: PointerEvent) => {
        pointerStartedInside.current = event.target instanceof Node && !!containerRef.current?.contains(event.target);
      };
      const onOutsideClick = (event: Event) => {
        const domNode = containerRef.current;
        if (!domNode) {
          return;
        }
        const startedInside = pointerStartedInside.current;
        pointerStartedInside.current = false;
        if (event.target instanceof Node && !domNode.contains(event.target) && !startedInside) {
          onClose();
        }
      };
      window.addEventListener('pointerdown', onPointerDown, true);
      window.addEventListener('click', onOutsideClick);
      return () => {
        window.removeEventListener('pointerdown', onPointerDown, true);
        window.removeEventListener('click', onOutsideClick);
      };
    }, [onClose]);

    const filterInputPlaceholder = t('grafana-ui.table.filter-popup-input-placeholder', 'Filter values');
    const clearFilterVisible = filterValue !== undefined;
    const styles = useStyles2(getStyles);

    if (!filterValue && field && (field.type === FieldType.number || field.type === FieldType.time)) {
      return (
        <FilterPopupLayout containerRef={containerRef} maxWidth={field.type === FieldType.time ? 424 : undefined}>
          <RangeFilter
            field={field}
            rows={rows}
            range={range}
            timeZone={timeZone}
            onCancel={() => {
              onClose();
              buttonElement?.focus();
            }}
            onClear={() => {
              onClearFilter();
              buttonElement?.focus();
            }}
            onApply={(next) => {
              onApplyRange?.(next);
              onClose();
              buttonElement?.focus();
            }}
          />
        </FilterPopupLayout>
      );
    }

    return (
      <FilterPopupLayout containerRef={containerRef} width={popupWidth}>
        <Stack direction="column" gap={1.5}>
          <Stack gap={1}>
            <FilterInput
              ref={inputRef}
              placeholder={filterInputPlaceholder}
              title={filterInputPlaceholder}
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
            onClear={clearFilterVisible ? onClearFilter : undefined}
            onCancel={onClose}
            onApply={onFilter}
            applyLabel={<Trans i18nKey="grafana-ui.table.filter-popup-apply">Ok</Trans>}
          />
        </Stack>
      </FilterPopupLayout>
    );
  }
);

FilterPopup.displayName = 'FilterPopup';
FilterPopupEditor.displayName = 'FilterPopupEditor';

const getStyles = memoize((theme: GrafanaTheme2) => ({
  buttonSelectOverrides: css({
    fontSize: 12,
    '&:hover, &:focus, &:active': {
      color: theme.colors.text.primary,
      background: 'transparent',
    },
  }),
}));
