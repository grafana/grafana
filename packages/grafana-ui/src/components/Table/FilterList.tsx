import { css, cx } from '@emotion/css';
import React, { useCallback, useMemo, useState } from 'react';
import { FixedSizeList as List } from 'react-window';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';

import { Checkbox, FilterInput, Label, VerticalGroup } from '..';
import { useStyles2, useTheme2 } from '../../themes';

interface Props {
  values: SelectableValue[];
  options: SelectableValue[];
  onChange: (options: SelectableValue[]) => void;
  caseSensitive?: boolean;
}

const ITEM_HEIGHT = 28;
const MIN_HEIGHT = ITEM_HEIGHT * 5;

export const FilterList = ({ options, values, caseSensitive, onChange }: Props) => {
  const [searchFilter, setSearchFilter] = useState('');
  const regex = useMemo(() => new RegExp(searchFilter, caseSensitive ? undefined : 'i'), [searchFilter, caseSensitive]);
  const items = useMemo(
    () =>
      options.filter((option) => {
        if (option.label === undefined) {
          return false;
        }
        return regex.test(option.label);
      }),
    [options, regex]
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
    <VerticalGroup spacing="md">
      <FilterInput placeholder="Filter values" onChange={setSearchFilter} value={searchFilter} />
      {!items.length && <Label>No values</Label>}
      {items.length && (
        <List
          height={height}
          itemCount={items.length}
          itemSize={ITEM_HEIGHT}
          width="100%"
          className={styles.filterList}
        >
          {({ index, style }) => {
            const option = items[index];
            const { value, label } = option;
            const isChecked = values.find((s) => s.value === value) !== undefined;

            return (
              <div className={styles.filterListRow} style={style} title={label}>
                <Checkbox value={isChecked} label={label} onChange={onCheckedChanged(option)} />
              </div>
            );
          }}
        </List>
      )}
      {items.length && (
        <VerticalGroup spacing="xs">
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
        </VerticalGroup>
      )}
    </VerticalGroup>
  );
};

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
});
