import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import { useCallback, useMemo } from 'react';
import * as React from 'react';
import { FixedSizeList as List, type ListChildComponentProps } from 'react-window';

import {
  FieldType,
  type GrafanaTheme2,
  formattedValueToString,
  getValueFormat,
  type SelectableValue,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../../../themes/ThemeContext';
import { Checkbox } from '../../../Forms/Checkbox';
import { Label } from '../../../Forms/Label';
import { Stack } from '../../../Layout/Stack/Stack';
import { FilterOperator } from '../types';

interface Props {
  values: SelectableValue[];
  options: SelectableValue[];
  onChange: (options: SelectableValue[]) => void;
  caseSensitive?: boolean;
  searchFilter: string;
  operator: SelectableValue<FilterOperator>;
  fieldType?: FieldType;
}

const ITEM_HEIGHT = 32;
const MIN_HEIGHT = ITEM_HEIGHT * 4.5; // split an item in the middle to imply there are more items to scroll

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

/**
 * Converts a time value (either a Unix epoch ms integer or a date string) to a
 * canonical ISO string so that both option values (raw ms) and user-typed search
 * filters (e.g. "2024-03-31" or "1743379200000") are comparable on equal footing.
 */
const toComparableTimeValue = (value: string): string | number | Date | boolean => {
  const trimmed = value.trim().replace(/\\/g, '');

  // Unix epoch ms — any integer that is plausibly a timestamp (post year 2001)
  const num = parseFloat(trimmed);
  if (!isNaN(num) && num > 978_307_200_000) {
    const fmt = getValueFormat('dateTimeAsIso');
    return formattedValueToString(fmt(num));
  }

  // Fall back to the standard handler which already parses YYYY-MM-DD date strings
  return comparableValue(trimmed);
};

export const FilterList = ({ options, values, caseSensitive, onChange, searchFilter, operator, fieldType }: Props) => {
  const regex = useMemo(() => new RegExp(searchFilter, caseSensitive ? undefined : 'i'), [searchFilter, caseSensitive]);
  const items = useMemo(
    () =>
      options.filter((option) => {
        if (!searchFilter || operator.value === FilterOperator.CONTAINS) {
          if (option.label === undefined) {
            return false;
          }
          return regex.test(option.label);
        } else if (operator.value === FilterOperator.EXPRESSION) {
          if (option.value === undefined) {
            return false;
          }
          try {
            const xpr = searchFilter.replace(/\\/g, '');
            const fnc = new Function('$', `'use strict'; return ${xpr};`);
            // option.value is string[] — use the first raw value as representative
            const rawFirst = Array.isArray(option.value) ? option.value[0] : option.value;
            const val = fieldType === FieldType.time ? toComparableTimeValue(rawFirst) : comparableValue(rawFirst);
            return fnc(val);
          } catch (_) {}
          return false;
        } else {
          if (option.value === undefined) {
            return false;
          }

          // option.value is string[] — use the first raw value as representative
          const rawFirst = Array.isArray(option.value) ? option.value[0] : option.value;
          const value1 = fieldType === FieldType.time ? toComparableTimeValue(rawFirst) : comparableValue(rawFirst);
          const value2 =
            fieldType === FieldType.time ? toComparableTimeValue(searchFilter) : comparableValue(searchFilter);

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
    [options, regex, operator, searchFilter, fieldType]
  );
  const selectedItems = useMemo(() => items.filter((item) => values.includes(item)), [items, values]);

  const selectCheckValue = useMemo(() => items.length === selectedItems.length, [items, selectedItems]);
  const selectCheckIndeterminate = useMemo(
    () => selectedItems.length > 0 && items.length > selectedItems.length,
    [items, selectedItems]
  );
  const selectCheckLabel = useMemo(() => {
    if (!values.length) {
      return t('grafana-ui.table.filter.select-all', 'Select all');
    }
    if (values.length !== selectedItems.length) {
      return t('grafana-ui.table.filter.selected-some-hidden', '{{ numSelected }} selected ({{ numHidden }} hidden)', {
        numSelected: values.length,
        numHidden: values.length - selectedItems.length,
      });
    }
    return t('grafana-ui.table.filter.selected', '{{ numSelected }} selected', {
      numSelected: values.length,
    });
  }, [selectedItems.length, values.length]);
  const selectCheckDescription = useMemo(
    () =>
      items.length !== selectedItems.length
        ? t('grafana-ui.table.filter.add-all', 'Add all displayed values to the filter')
        : t('grafana-ui.table.filter.remove-all', 'Remove all displayed values from the filter'),
    [items, selectedItems]
  );

  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const gutter = theme.spacing.gridSize / 2;
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
    <Stack direction="column">
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
          <div
            className={styles.filterListRow}
            data-testid={selectors.components.Panels.Visualization.TableNG.Filters.SelectAll}
          >
            <Checkbox
              value={selectCheckValue}
              indeterminate={selectCheckIndeterminate}
              label={selectCheckLabel}
              description={selectCheckDescription}
              onChange={onSelectChanged}
            />
          </div>
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

const getStyles = memoize((theme: GrafanaTheme2) => ({
  filterList: css({
    label: 'filterList',
    marginBottom: theme.spacing(0.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
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
  noValuesLabel: css({
    paddingTop: theme.spacing(1),
  }),
}));
