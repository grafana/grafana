import React, { FC, useCallback, useMemo, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { css } from '@emotion/css';
import { GrafanaThemeV2, SelectableValue } from '@grafana/data';

import { stylesFactory, useTheme2 } from '../../themes';
import { Checkbox, Input, Label, VerticalGroup } from '..';

interface Props {
  values: SelectableValue[];
  options: SelectableValue[];
  onChange: (options: SelectableValue[]) => void;
}

const ITEM_HEIGHT = 28;
const MIN_HEIGHT = ITEM_HEIGHT * 5;

export const FilterList: FC<Props> = ({ options, values, onChange }) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const [searchFilter, setSearchFilter] = useState('');
  const items = useMemo(() => options.filter((option) => option.label?.indexOf(searchFilter) !== -1), [
    options,
    searchFilter,
  ]);
  const gutter = theme.spacing.gridSize;
  const height = useMemo(() => Math.min(items.length * ITEM_HEIGHT, MIN_HEIGHT) + gutter, [gutter, items.length]);

  const onInputChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      setSearchFilter(event.currentTarget.value);
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
      <Input
        placeholder="filter values"
        className={styles.filterListInput}
        onChange={onInputChange}
        value={searchFilter}
      />
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

const getStyles = stylesFactory((theme: GrafanaThemeV2) => ({
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
  filterListInput: css`
    label: filterListInput;
  `,
}));
