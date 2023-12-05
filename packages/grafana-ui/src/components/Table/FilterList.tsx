import { css } from '@emotion/css';
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
  const onSearchFilterChanged = (value: string) => {
    if (value === '') {
      setSelectAll(false);
    }
    setSearchFilter(value);
  };
  const getItemLength = (): number => {
    return searchFilter !== '' ? items.length + 1 : items.length;
  };

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

  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const gutter = theme.spacing.gridSize;
  const height = useMemo(() => Math.min(getItemLength() * ITEM_HEIGHT, MIN_HEIGHT) + gutter, [gutter, items.length]);

  const onCheckedChanged = useCallback(
    (option: SelectableValue) => (event: React.FormEvent<HTMLInputElement>) => {
      const newValues = event.currentTarget.checked
        ? values.concat(option)
        : values.filter((c) => c.value !== option.value);

      onChange(newValues);
    },
    [onChange, values]
  );

  const [selectAll, setSelectAll] = useState(false);
  const onSelectAllChanged = useCallback(
    () => (event: React.FormEvent<HTMLInputElement>) => {
      setSelectAll(!selectAll);
      const newValues = event.currentTarget.checked ? values.concat(items) : [];
      onChange(newValues);
    },
    [onChange, values, items]
  );

  return (
    <VerticalGroup spacing="md">
      <FilterInput placeholder="Filter values" onChange={onSearchFilterChanged} value={searchFilter} />
      {!items.length && <Label>No values</Label>}
      {items.length && (
        <List
          height={height}
          itemCount={getItemLength()}
          itemSize={ITEM_HEIGHT}
          width="100%"
          className={styles.filterList}
        >
          {({ index, style }) => {
            if (index === 0 && searchFilter !== '') {
              return (
                <div className={styles.filterListRow} style={style}>
                  <Checkbox value={selectAll} label="Select All" onChange={onSelectAllChanged()} />
                </div>
              );
            }

            const option = items[searchFilter !== '' ? index - 1 : index];
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
});
