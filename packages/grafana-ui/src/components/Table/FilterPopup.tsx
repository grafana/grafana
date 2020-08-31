import React, { FC, useCallback, useMemo, useState } from 'react';
import { Field, formattedValueToString, GrafanaTheme, SelectableValue } from '@grafana/data';
import { css, cx } from 'emotion';

import { TableStyles } from './styles';
import { stylesFactory, useStyles } from '../../themes';
import { Button, ClickOutsideWrapper, HorizontalGroup, Label, VerticalGroup } from '..';
import { FilterList } from './FilterList';

interface Props {
  column: any;
  tableStyles: TableStyles;
  onClose: () => void;
  field?: Field;
}

export const FilterPopup: FC<Props> = ({ column: { preFilteredRows, filterValue, setFilter }, onClose, field }) => {
  const uniqueValues = useMemo(() => calculateUniqueFieldValues(preFilteredRows, field), [preFilteredRows, field]);
  const options = useMemo(() => valuesToOptions(uniqueValues), [uniqueValues]);
  const filteredOptions = useMemo(() => getFilteredOptions(options, filterValue), [options, filterValue]);
  const [values, setValues] = useState<SelectableValue[]>(filteredOptions ?? []);

  const onCancel = useCallback((event?: React.MouseEvent) => onClose(), [onClose]);

  const onFilter = useCallback(
    (event: React.MouseEvent) => {
      const filtered = values.length ? values : undefined;

      setFilter(filtered);
      onClose();
    },
    [setFilter, values, onClose]
  );

  const onClearFilter = useCallback(
    (event: React.MouseEvent) => {
      setFilter(undefined);
      onClose();
    },
    [setFilter, onClose]
  );

  const clearFilterVisible = useMemo(() => filterValue !== undefined, [filterValue]);
  const styles = useStyles(getStyles);

  return (
    <ClickOutsideWrapper onClick={onCancel} useCapture={true}>
      <div className={cx(styles.filterContainer)} onClick={stopPropagation}>
        <VerticalGroup spacing="lg">
          <VerticalGroup spacing="xs">
            <Label>Filter by values:</Label>
            <div className={cx(styles.listDivider)} />
            <FilterList onChange={setValues} values={values} options={options} />
          </VerticalGroup>
          <HorizontalGroup spacing="lg">
            <HorizontalGroup>
              <Button size="sm" onClick={onFilter}>
                Ok
              </Button>
              <Button size="sm" variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
            </HorizontalGroup>
            {clearFilterVisible && (
              <HorizontalGroup>
                <Button variant="link" size="sm" onClick={onClearFilter}>
                  Clear filter
                </Button>
              </HorizontalGroup>
            )}
          </HorizontalGroup>
        </VerticalGroup>
      </div>
    </ClickOutsideWrapper>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  filterContainer: css`
    label: filterContainer;
    width: 100%;
    min-width: 250px;
    height: 100%;
    max-height: 400px;
    background-color: ${theme.colors.bg1};
    border: ${theme.border.width.sm} solid ${theme.colors.border2};
    padding: ${theme.spacing.md};
    margin: ${theme.spacing.sm} 0;
    box-shadow: 0px 0px 20px ${theme.colors.dropdownShadow};
    border-radius: ${theme.spacing.xs};
  `,
  listDivider: css`
    label: listDivider;
    width: 100%;
    border-top: ${theme.border.width.sm} solid ${theme.colors.border2};
    padding: ${theme.spacing.xs} ${theme.spacing.md};
  `,
}));

const calculateUniqueFieldValues = (rows: any[], field?: Field) => {
  if (!field || rows.length === 0) {
    return {};
  }

  const set: Record<string, any> = {};

  for (let index = 0; index < rows.length; index++) {
    const fieldIndex = parseInt(rows[index].id, 10);
    const fieldValue = field.values.get(fieldIndex);
    const displayValue = field.display ? field.display(fieldValue) : fieldValue;
    const value = field.display ? formattedValueToString(displayValue) : displayValue;
    set[value || '(Blanks)'] = fieldValue;
  }

  return set;
};

const valuesToOptions = (unique: Record<string, any>): SelectableValue[] =>
  Object.keys(unique)
    .reduce((all, key) => all.concat({ value: unique[key], label: key }), [] as SelectableValue[])
    .sort(sortOption);

const sortOption = (a: SelectableValue, b: SelectableValue): number => {
  if (a.label === undefined && b.label === undefined) {
    return 0;
  }

  if (a.label === undefined && b.label !== undefined) {
    return -1;
  }

  if (a.label !== undefined && b.label === undefined) {
    return 1;
  }

  if (a.label! < b.label!) {
    return -1;
  }

  if (a.label! > b.label!) {
    return 1;
  }

  return 0;
};

const getFilteredOptions = (options: SelectableValue[], filterValues?: SelectableValue[]) => {
  if (!filterValues) {
    return null;
  }

  return options.filter(option => filterValues.some(filtered => filtered.value === option.value));
};

const stopPropagation = (event: React.MouseEvent) => {
  event.stopPropagation();
};
