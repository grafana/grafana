import React, { FC, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { css, cx } from 'emotion';
import { GrafanaTheme, SelectableValue } from '@grafana/data';

import { stylesFactory, useTheme } from '../../themes';
import { Checkbox } from '..';

interface Props {
  values: SelectableValue[];
  options: SelectableValue[];
  onChange: (options: SelectableValue[]) => void;
}

export const FilterList: FC<Props> = ({ options, values, onChange }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const itemHeight = 28;
  const minHeight = itemHeight * 5;
  const gutter = parseInt(theme.spacing.sm, 10);
  const height = useMemo(() => Math.min(options.length * itemHeight, minHeight) + gutter, [options]);
  const onCheckedChanged = useCallback(
    (option: SelectableValue) => (event: React.FormEvent<HTMLInputElement>) => {
      const newChecked = event.currentTarget.checked
        ? values.concat(option)
        : values.filter(c => c.value !== option.value);

      onChange(newChecked);
    },
    [onChange, values]
  );

  return (
    <List
      height={height}
      itemCount={options.length}
      itemSize={itemHeight}
      width="100%"
      className={cx(styles.filterList)}
    >
      {({ index, style }) => {
        const option = options[index];
        const { value, label } = option;
        const isChecked = values.find(s => s.value === value) !== undefined;

        return (
          <div className={cx(styles.filterListRow)} style={style} title={label}>
            <Checkbox value={isChecked} label={label} onChange={onCheckedChanged(option)} />
          </div>
        );
      }}
    </List>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  filterList: css`
    label: filterList;
  `,
  filterListRow: css`
    label: filterListRow;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: ${theme.spacing.xs};
    :hover {
      background-color: ${theme.colors.bg3};
    }
  `,
}));
