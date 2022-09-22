import { css } from '@emotion/css';
import React, { FC, useCallback, useMemo, useState } from 'react';
import { FixedSizeList as List } from 'react-window';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';

import { Checkbox, FilterInput, Label, VerticalGroup } from '..';
import { stylesFactory, useTheme2 } from '../../themes';

interface Props {
  values: SelectableValue[];
  options: SelectableValue[];
  onChange: (options: SelectableValue[]) => void;
  caseSensitive?: boolean;
}

const ITEM_HEIGHT = 28;
const MIN_HEIGHT = ITEM_HEIGHT * 5;

export const FilterList: FC<Props> = ({ options, values, caseSensitive, onChange }) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
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
  const gutter = theme.spacing.gridSize;
  const height = useMemo(() => Math.min(items.length * ITEM_HEIGHT, MIN_HEIGHT) + gutter, [gutter, items.length]);

  const onInputChange = useCallback(
    (v: string) => {
      setSearchFilter(v);
    },
    [setSearchFilter]
  );

  const onCheckedChanged = useCallback(
    (option: SelectableValue) => (event: React.FormEvent<HTMLInputElement>) => {
      const newValues = event.currentTarget.checked
        ? values.concat(option)
        : values.filter((c) => c.value !== option.value);

      onChange(newValues);
    },
    [onChange, values]
  );

  return (
    <VerticalGroup spacing="md">
      <FilterInput placeholder="Filter values" onChange={onInputChange} value={searchFilter} />
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
    </VerticalGroup>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  filterList: css`
    label: filterList;
  `,
  filterListRow: css`
    label: filterListRow;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: ${theme.spacing(0.5)};

    :hover {
      background-color: ${theme.colors.action.hover};
    }
  `,
}));
