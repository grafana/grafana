import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import { useCallback, useMemo } from 'react';
import * as React from 'react';
import { FixedSizeList as List, type ListChildComponentProps } from 'react-window';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../../../themes/ThemeContext';
import { Checkbox } from '../../../Forms/Checkbox';
import { Label } from '../../../Forms/Label';
import { Stack } from '../../../Layout/Stack/Stack';
import { comparableValue, parseExpression } from '../../filterExpression';
import { FilterOperator } from '../types';

interface Props {
  values: SelectableValue[];
  options: SelectableValue[];
  onChange: (options: SelectableValue[]) => void;
  caseSensitive?: boolean;
  searchFilter: string;
  operator: SelectableValue<FilterOperator>;
}

const ITEM_HEIGHT = 32;
const MIN_HEIGHT = ITEM_HEIGHT * 4.5; // split an item in the middle to imply there are more items to scroll

export const FilterList = ({ options, values, caseSensitive, onChange, searchFilter, operator }: Props) => {
  const regex = useMemo(() => new RegExp(searchFilter, caseSensitive ? undefined : 'i'), [searchFilter, caseSensitive]);
  const predicate = useMemo(() => {
    if (!searchFilter || operator.value === FilterOperator.CONTAINS) {
      return null;
    }
    if (operator.value === FilterOperator.EXPRESSION) {
      return parseExpression(searchFilter) ?? (() => false);
    }
    return parseExpression(`$ ${operator.value} ${searchFilter}`) ?? (() => false);
  }, [searchFilter, operator]);

  const items = useMemo(
    () =>
      options.filter((option) => {
        if (predicate === null) {
          return option.label !== undefined && regex.test(option.label);
        }
        if (option.value === undefined) {
          return false;
        }
        return predicate(comparableValue(option.value));
      }),
    [options, regex, predicate]
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
