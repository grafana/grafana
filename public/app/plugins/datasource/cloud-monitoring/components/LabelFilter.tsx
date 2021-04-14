import React, { FunctionComponent, useCallback, useMemo } from 'react';
import flatten from 'lodash/flatten';
import { SelectableValue } from '@grafana/data';
import { CustomControlProps } from '@grafana/ui/src/components/Select/types';
import { Button, HorizontalGroup, Select, VerticalGroup } from '@grafana/ui';
import { labelsToGroupedOptions, stringArrayToFilters, toOption } from '../functions';
import { Filter } from '../types';
import { LABEL_WIDTH, SELECT_WIDTH } from '../constants';
import { InlineFields } from '.';

export interface Props {
  labels: { [key: string]: string[] };
  filters: string[];
  onChange: (filters: string[]) => void;
  variableOptionGroup: SelectableValue<string>;
}

const operators = ['=', '!=', '=~', '!=~'];

const FilterButton = React.forwardRef<HTMLButtonElement, CustomControlProps<string>>(({ value, ...rest }, ref) => {
  return (
    <Button ref={ref} {...rest} variant="secondary" icon="plus">
      Add filter
    </Button>
  );
});
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
    return strArr.filter((_, i) => i !== strArr.length - 1);
  }, []);

  return (
    <InlineFields
      label="Filter"
      transparent
      labelWidth={LABEL_WIDTH}
      tooltip={
        'To reduce the amount of data charted, apply a filter. A filter has three components: a label, a comparison, and a value. The comparison can be an equality, inequality, or regular expression.'
      }
    >
      <VerticalGroup spacing="xs">
        {filters.map(({ key, operator, value, condition }, index) => (
          <HorizontalGroup key={index} spacing="xs">
            <Select
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
              value={operator}
              options={operators.map(toOption)}
              onChange={({ value: operator = '=' }) =>
                onChange(filtersToStringArray(filters.map((f, i) => (i === index ? { ...f, operator } : f))))
              }
              menuPlacement="bottom"
              renderControl={OperatorButton}
            />
            <Select
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
          </HorizontalGroup>
        ))}
        {Object.values(filters).every(({ value }) => value) && (
          <Select
            allowCustomValue
            options={[variableOptionGroup, ...labelsToGroupedOptions(Object.keys(labels))]}
            onChange={({ value: key = '' }) =>
              onChange(
                filtersToStringArray([...filters, { key, operator: '=', condition: 'AND', value: '' } as Filter])
              )
            }
            menuPlacement="bottom"
            renderControl={FilterButton}
          />
        )}
      </VerticalGroup>
    </InlineFields>
  );
};
