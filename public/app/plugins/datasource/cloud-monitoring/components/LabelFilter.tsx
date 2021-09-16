import React, { FunctionComponent, useCallback, useMemo } from 'react';
import { flatten } from 'lodash';

import { SelectableValue } from '@grafana/data';
import { CustomControlProps } from '@grafana/ui/src/components/Select/types';
import { Button, HorizontalGroup, Select, VerticalGroup } from '@grafana/ui';
import { labelsToGroupedOptions, stringArrayToFilters, toOption } from '../functions';
import { Filter } from '../types';
import { SELECT_WIDTH } from '../constants';
import { QueryEditorRow } from '.';

export interface Props {
  labels: { [key: string]: string[] };
  filters: string[];
  onChange: (filters: string[]) => void;
  variableOptionGroup: SelectableValue<string>;
}

const operators = ['=', '!=', '=~', '!=~'];

const FilterButton = React.forwardRef<HTMLButtonElement, CustomControlProps<string>>(
  ({ value, isOpen, invalid, ...rest }, ref) => {
    return <Button ref={ref} {...rest} variant="secondary" icon="plus"></Button>;
  }
);
FilterButton.displayName = 'FilterButton';

const OperatorButton = React.forwardRef<HTMLButtonElement, CustomControlProps<string>>(({ value, ...rest }, ref) => {
  return (
    <Button ref={ref} {...rest} variant="secondary">
      <span className="query-segment-operator">{value?.label}</span>
    </Button>
  );
});
OperatorButton.displayName = 'OperatorButton';

export const LabelFilter: FunctionComponent<Props> = ({
  labels = {},
  filters: filterArray,
  onChange,
  variableOptionGroup,
}) => {
  const filters = useMemo(() => stringArrayToFilters(filterArray), [filterArray]);
  const options = useMemo(() => [variableOptionGroup, ...labelsToGroupedOptions(Object.keys(labels))], [
    labels,
    variableOptionGroup,
  ]);

  const filtersToStringArray = useCallback((filters: Filter[]) => {
    const strArr = flatten(filters.map(({ key, operator, value, condition }) => [key, operator, value, condition!]));
    return strArr.slice(0, strArr.length - 1);
  }, []);

  const AddFilter = () => {
    return (
      <Select
        menuShouldPortal
        allowCustomValue
        options={[variableOptionGroup, ...labelsToGroupedOptions(Object.keys(labels))]}
        onChange={({ value: key = '' }) =>
          onChange(filtersToStringArray([...filters, { key, operator: '=', condition: 'AND', value: '' }]))
        }
        menuPlacement="bottom"
        renderControl={FilterButton}
      />
    );
  };

  return (
    <QueryEditorRow
      label="Filter"
      tooltip={
        'To reduce the amount of data charted, apply a filter. A filter has three components: a label, a comparison, and a value. The comparison can be an equality, inequality, or regular expression.'
      }
      noFillEnd={filters.length > 1}
    >
      <VerticalGroup spacing="xs" width="auto">
        {filters.map(({ key, operator, value, condition }, index) => (
          <HorizontalGroup key={index} spacing="xs" width="auto">
            <Select
              menuShouldPortal
              width={SELECT_WIDTH}
              allowCustomValue
              formatCreateLabel={(v) => `Use label key: ${v}`}
              value={key}
              options={options}
              onChange={({ value: key = '' }) => {
                onChange(
                  filtersToStringArray(
                    filters.map((f, i) => (i === index ? { key, operator, condition, value: '' } : f))
                  )
                );
              }}
            />
            <Select
              menuShouldPortal
              value={operator}
              options={operators.map(toOption)}
              onChange={({ value: operator = '=' }) =>
                onChange(filtersToStringArray(filters.map((f, i) => (i === index ? { ...f, operator } : f))))
              }
              menuPlacement="bottom"
              renderControl={OperatorButton}
            />
            <Select
              menuShouldPortal
              width={SELECT_WIDTH}
              formatCreateLabel={(v) => `Use label value: ${v}`}
              allowCustomValue
              value={value}
              placeholder="add filter value"
              options={
                labels.hasOwnProperty(key) ? [variableOptionGroup, ...labels[key].map(toOption)] : [variableOptionGroup]
              }
              onChange={({ value = '' }) =>
                onChange(filtersToStringArray(filters.map((f, i) => (i === index ? { ...f, value } : f))))
              }
            />
            <Button
              variant="secondary"
              size="md"
              icon="trash-alt"
              aria-label="Remove"
              onClick={() => onChange(filtersToStringArray(filters.filter((_, i) => i !== index)))}
            ></Button>
            {index + 1 === filters.length && Object.values(filters).every(({ value }) => value) && <AddFilter />}
          </HorizontalGroup>
        ))}
        {!filters.length && <AddFilter />}
      </VerticalGroup>
    </QueryEditorRow>
  );
};
