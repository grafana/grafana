import React, { FC, useMemo, useState } from 'react';
import { Field, formattedValueToString, GrafanaTheme, SelectableValue } from '@grafana/data';
import { css, cx } from 'emotion';

import { TableStyles } from './styles';
import { stylesFactory, useTheme } from '../../themes';
import { Button, ClickOutsideWrapper, HorizontalGroup, Label, MultiSelect, VerticalGroup } from '..';

interface Props {
  column: any;
  tableStyles: TableStyles;
  field?: Field;
  onHide: () => void;
}

export const FilterPopup: FC<Props> = ({ onHide, column, field }) => {
  const unique = useMemo(() => calculateUniqueFieldValues(field), [field]);
  const options = useMemo(() => getOptions(unique), [unique]);
  const filterValues = useMemo(() => getValues(options, column.filterValue), [options, column.filterValue]);
  const [values, setValues] = useState<SelectableValue[]>(filterValues ?? []);
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <ClickOutsideWrapper onClick={onHide} useCapture={true}>
      <div className={cx(styles.filterContainer)} onClick={stopPropagation}>
        <VerticalGroup spacing="lg">
          <VerticalGroup spacing="xs">
            <Label>Filter by values:</Label>
            <MultiSelect onChange={setValues} value={values} options={options} />
          </VerticalGroup>
          <HorizontalGroup spacing="lg">
            <HorizontalGroup>
              <Button size="sm" onClick={submitChange(column.setFilter, values, onHide)}>
                Ok
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onHide()}>
                Cancel
              </Button>
            </HorizontalGroup>
            <HorizontalGroup>
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  column.setFilter(undefined);
                  onHide();
                }}
                disabled={column.filterValue === undefined}
              >
                Clear filter
              </Button>
            </HorizontalGroup>
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

const getOptions = (unique: Record<string, any>): Array<SelectableValue<string>> =>
  Object.keys(unique)
    .reduce((all, key) => all.concat({ value: unique[key], label: key }), [] as Array<SelectableValue<string>>)
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

const getValues = (options: SelectableValue[], filterValues?: SelectableValue[]) => {
  if (!filterValues) {
    return null;
  }

  return options.filter(option => filterValues.some(filtered => filtered === option.value));
};

const optionsToValues = (options: SelectableValue[]): any[] => {
  const filter = options.reduce((all, option) => all.concat(option.value), [] as any[]);
  return filter;
};

const submitChange = (setFilter: (...args: any) => void, options: SelectableValue[], onHide: () => void) => (
  event: React.MouseEvent
): void => {
  const values = optionsToValues(options);
  const filtered = values.length ? values : undefined;

  setFilter(filtered);
  onHide();
};

const stopPropagation = (event: React.MouseEvent) => {
  event.stopPropagation();
};
