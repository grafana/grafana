import React, { FC, useCallback, useMemo, useState } from 'react';
import { Field, formattedValueToString, GrafanaTheme, SelectableValue } from '@grafana/data';
import { css, cx } from 'emotion';

import { TableStyles } from './styles';
import { stylesFactory, useTheme } from '../../themes';
import { Button, ClickOutsideWrapper, HorizontalGroup, Label, MultiSelect, VerticalGroup } from '..';

interface Props {
  column: any;
  tableStyles: TableStyles;
  field?: Field;
  onClose: () => void;
}

export const FilterPopup: FC<Props> = ({ onClose, column, field }) => {
  const uniqueValues = useMemo(() => calculateUniqueFieldValues(field), [field]);
  const options = useMemo(() => valuesToOptions(uniqueValues), [uniqueValues]);
  const filteredOptions = useMemo(() => getFilteredOptions(options, column.filterValue), [options, column.filterValue]);
  const [values, setValues] = useState<SelectableValue[]>(filteredOptions ?? []);

  const onCancel = useCallback((event?: React.MouseEvent) => onClose(), [onClose]);

  const onFilter = useCallback(
    (event: React.MouseEvent) => {
      const filtered = values.length ? values : undefined;

      column.setFilter(filtered);
      onClose();
    },
    [column.setFilter, values, onClose]
  );

  const onClearFilter = useCallback(
    (event: React.MouseEvent) => {
      column.setFilter(undefined);
      onClose();
    },
    [column.setFilter, onClose]
  );

  const clearFilterVisible = useMemo(() => column.filterValue !== undefined, [column.filterValue]);

  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <ClickOutsideWrapper onClick={onCancel} useCapture={true}>
      <div className={cx(styles.filterContainer)} onClick={stopPropagation}>
        <VerticalGroup spacing="lg">
          <VerticalGroup spacing="xs">
            <Label>Filter by values:</Label>
            <MultiSelect onChange={setValues} value={values} options={options} />
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
    min-width: 200px;
    height: 140px;
    background-color: ${theme.colors.bg1};
    border: ${theme.border.width.sm} solid ${theme.colors.border2};
    padding: ${theme.spacing.md};
    margin: ${theme.spacing.sm} 0px;
    box-shadow: 0px 0px 20px ${theme.colors.dropdownShadow};
    border-radius: ${theme.spacing.xs};
  `,
}));

const calculateUniqueFieldValues = (field?: Field) => {
  if (!field) {
    return null;
  }

  if (!field.state) {
    field.state = {};
  }

  if (!field.state.calcs) {
    field.state.calcs = {};
  }

  if (!field.state.calcs.unique) {
    const set: Record<string, any> = {};
    for (let index = 0; index < field.values.length; index++) {
      const fieldValue = field.values.get(index);
      const displayValue = field.display ? field.display(fieldValue) : fieldValue;
      const value = field.display ? formattedValueToString(displayValue) : displayValue;
      set[value] = fieldValue;
    }

    field.state.calcs.unique = set;
  }

  return field.state.calcs.unique;
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
