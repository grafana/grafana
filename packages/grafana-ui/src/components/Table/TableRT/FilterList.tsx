import { css, cx } from '@emotion/css';
import { useCallback, useMemo } from 'react';
import * as React from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';

import { GrafanaTheme2, formattedValueToString, getValueFormat, SelectableValue } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../../themes/ThemeContext';
import { ButtonSelect } from '../../Dropdown/ButtonSelect';
import { FilterInput } from '../../FilterInput/FilterInput';
import { Checkbox } from '../../Forms/Checkbox';
import { Label } from '../../Forms/Label';
import { Stack } from '../../Layout/Stack/Stack';

interface Props {
  values: SelectableValue[];
  options: SelectableValue[];
  onChange: (options: SelectableValue[]) => void;
  caseSensitive?: boolean;
  showOperators?: boolean;
  searchFilter: string;
  setSearchFilter: (value: string) => void;
  operator: SelectableValue<string>;
  setOperator: (item: SelectableValue<string>) => void;
}

const ITEM_HEIGHT = 28;
const MIN_HEIGHT = ITEM_HEIGHT * 5;

const operatorSelectableValues: { [key: string]: SelectableValue<string> } = {
  Contains: { label: 'Contains', value: 'Contains', description: 'Contains' },
  '=': { label: '=', value: '=', description: 'Equals' },
  '!=': { label: '!=', value: '!=', description: 'Not equals' },
  '>': { label: '>', value: '>', description: 'Greater' },
  '>=': { label: '>=', value: '>=', description: 'Greater or Equal' },
  '<': { label: '<', value: '<', description: 'Less' },
  '<=': { label: '<=', value: '<=', description: 'Less or Equal' },
  Expression: {
    label: 'Expression',
    value: 'Expression',
    description: 'Bool Expression (Char $ represents the column value in the expression, e.g. "$ >= 10 && $ <= 12")',
  },
};
const OPERATORS = Object.values(operatorSelectableValues);
export const REGEX_OPERATOR = operatorSelectableValues['Contains'];
const XPR_OPERATOR = operatorSelectableValues['Expression'];

const comparableValue = (value: string): string | number | Date | boolean => {
  value = value.trim().replace(/\\/g, '');

  // Does it look like a Date (Starting with pattern YYYY-MM-DD* or YYYY/MM/DD*)?
  if (/^(\d{4}-\d{2}-\d{2}|\d{4}\/\d{2}\/\d{2})/.test(value)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const fmt = getValueFormat('dateTimeAsIso');
      return formattedValueToString(fmt(date.getTime()));
    }
  }
  // Does it look like a Number?
  const num = parseFloat(value);
  if (!isNaN(num)) {
    return num;
  }
  // Does it look like a Bool?
  const lvalue = value.toLowerCase();
  if (lvalue === 'true' || lvalue === 'false') {
    return lvalue === 'true';
  }
  // Anything else
  return value;
};

export const FilterList = ({
  options,
  values,
  caseSensitive,
  showOperators,
  onChange,
  searchFilter,
  setSearchFilter,
  operator,
  setOperator,
}: Props) => {
  const regex = useMemo(() => new RegExp(searchFilter, caseSensitive ? undefined : 'i'), [searchFilter, caseSensitive]);
  const items = useMemo(
    () =>
      options.filter((option) => {
        if (!showOperators || !searchFilter || operator.value === REGEX_OPERATOR.value) {
          if (option.label === undefined) {
            return false;
          }
          return regex.test(option.label);
        } else if (operator.value === XPR_OPERATOR.value) {
          if (option.value === undefined) {
            return false;
          }
          try {
            const xpr = searchFilter.replace(/\\/g, '');
            const fnc = new Function('$', `'use strict'; return ${xpr};`);
            const val = comparableValue(option.value);
            return fnc(val);
          } catch (_) {}
          return false;
        } else {
          if (option.value === undefined) {
            return false;
          }

          const value1 = comparableValue(option.value);
          const value2 = comparableValue(searchFilter);

          switch (operator.value) {
            case '=':
              return value1 === value2;
            case '!=':
              return value1 !== value2;
            case '>':
              return value1 > value2;
            case '>=':
              return value1 >= value2;
            case '<':
              return value1 < value2;
            case '<=':
              return value1 <= value2;
          }
          return false;
        }
      }),
    [options, regex, showOperators, operator, searchFilter]
  );
  const selectedItems = useMemo(() => items.filter((item) => values.includes(item)), [items, values]);

  const selectCheckValue = useMemo(() => items.length === selectedItems.length, [items, selectedItems]);
  const selectCheckIndeterminate = useMemo(
    () => selectedItems.length > 0 && items.length > selectedItems.length,
    [items, selectedItems]
  );
  const selectCheckLabel = useMemo(
    () => (selectedItems.length ? `${selectedItems.length} selected` : `Select all`),
    [selectedItems]
  );
  const selectCheckDescription = useMemo(
    () =>
      items.length !== selectedItems.length
        ? 'Add all displayed values to the filter'
        : 'Remove all displayed values from the filter',
    [items, selectedItems]
  );

  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const gutter = theme.spacing.gridSize;
  const height = useMemo(() => Math.min(items.length * ITEM_HEIGHT, MIN_HEIGHT) + gutter, [gutter, items.length]);

  const onCheckedChanged = useCallback(
    (option: SelectableValue) => (event: React.FormEvent<HTMLInputElement>) => {
      const newValues = event.currentTarget.checked
        ? values.concat(option)
        : values.filter((c) => c.value !== option.value);

      onChange(newValues);
    },
    [onChange, values]
  );

  const onSelectChanged = useCallback(() => {
    if (items.length === selectedItems.length) {
      const newValues = values.filter((item) => !items.includes(item));
      onChange(newValues);
    } else {
      const newValues = [...new Set([...values, ...items])];
      onChange(newValues);
    }
  }, [onChange, values, items, selectedItems]);

  return (
    <Stack direction="column" gap={0.25}>
      {!showOperators && (
        <FilterInput
          placeholder={t('grafana-ui.table.filter-placeholder', 'Filter values')}
          onChange={setSearchFilter}
          value={searchFilter}
        />
      )}
      {showOperators && (
        <Stack direction="row" gap={0}>
          <ButtonSelect
            variant="canvas"
            options={OPERATORS}
            onChange={setOperator}
            value={operator}
            tooltip={operator.description}
          />
          <FilterInput
            placeholder={t('grafana-ui.table.filter-placeholder', 'Filter values')}
            onChange={setSearchFilter}
            value={searchFilter}
          />
        </Stack>
      )}
      {items.length > 0 ? (
        <>
          <List
            height={height}
            itemCount={items.length}
            itemSize={ITEM_HEIGHT}
            itemData={{ items, values: selectedItems, onCheckedChanged, className: styles.filterListRow }}
            width="100%"
            className={styles.filterList}
          >
            {ItemRenderer}
          </List>
          <Stack direction="column" gap={0.25}>
            <div className={cx(styles.selectDivider)} />
            <div className={cx(styles.filterListRow)}>
              <Checkbox
                value={selectCheckValue}
                indeterminate={selectCheckIndeterminate}
                label={selectCheckLabel}
                description={selectCheckDescription}
                onChange={onSelectChanged}
              />
            </div>
          </Stack>
        </>
      ) : (
        <Label className={styles.noValuesLabel}>
          <Trans i18nKey="grafana-ui.table.no-values-label">No values</Trans>
        </Label>
      )}
    </Stack>
  );
};

interface ItemRendererProps extends ListChildComponentProps {
  data: {
    onCheckedChanged: (option: SelectableValue) => (event: React.FormEvent<HTMLInputElement>) => void;
    items: SelectableValue[];
    values: SelectableValue[];
    className: string;
  };
}

function ItemRenderer({ index, style, data: { onCheckedChanged, items, values, className } }: ItemRendererProps) {
  const option = items[index];
  const { value, label } = option;
  const isChecked = values.find((s) => s.value === value) !== undefined;

  return (
    <div className={className} style={style} title={label}>
      <Checkbox value={isChecked} label={label} onChange={onCheckedChanged(option)} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  filterList: css({
    label: 'filterList',
  }),
  filterListRow: css({
    label: 'filterListRow',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    padding: theme.spacing(0.5),

    ':hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  selectDivider: css({
    label: 'selectDivider',
    width: '100%',
    borderTop: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(0.5, 2),
  }),
  noValuesLabel: css({
    paddingTop: theme.spacing(1),
  }),
});
