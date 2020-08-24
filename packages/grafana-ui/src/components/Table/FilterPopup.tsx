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
  const styles = getStyles(theme, column);

  return (
    <ClickOutsideWrapper onClick={onHide} useCapture={true}>
      <div className={cx(styles.filterContainer)} onClick={stopPropagation}>
        <VerticalGroup spacing="md">
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              column.setFilter(undefined);
              onHide();
            }}
          >
            Clear filter
          </Button>
          <Label>Filter by values:</Label>
          <MultiSelect onChange={setValues} value={values} options={options} closeMenuOnSelect={false} />
          <HorizontalGroup>
            <Button size="sm" variant="secondary" onClick={() => onHide()}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitChange(column.setFilter, values, onHide)}>
              Ok
            </Button>
          </HorizontalGroup>
        </VerticalGroup>
      </div>
    </ClickOutsideWrapper>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme, column: any) => ({
  filterContainer: css`
    label: filterContainer;
    width: 100%;
    height: 180px;
    background-color: ${theme.colors.bg1};
    border: ${theme.border.width.sm} solid ${theme.colors.border1};
    padding: ${theme.spacing.sm};
    margin: ${theme.spacing.xs} 0px;
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
  Object.keys(unique).reduce(
    (all, key) => all.concat({ value: unique[key], label: key }),
    [] as Array<SelectableValue<string>>
  );

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
  setFilter(values);
  onHide();
};

const stopPropagation = (event: React.MouseEvent) => {
  console.log('stopPropagation');
  event.stopPropagation();
};
