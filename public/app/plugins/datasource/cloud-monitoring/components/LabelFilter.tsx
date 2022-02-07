import { SelectableValue, toOption } from '@grafana/data';
import { Button, HorizontalGroup, Select, VerticalGroup } from '@grafana/ui';
import { CustomControlProps } from '@grafana/ui/src/components/Select/types';
import { flatten } from 'lodash';
import React, { FunctionComponent, useCallback, useMemo } from 'react';

import { QueryEditorRow } from '.';
import { SELECT_WIDTH } from '../constants';
import { labelsToGroupedOptions, stringArrayToFilters } from '../functions';
import { Filter } from '../types';

export interface Props {
  labels: { [key: string]: string[] };
  filters: string[];
  onChange: (filters: string[]) => void;
  variableOptionGroup: SelectableValue<string>;
}

const operators = ['=', '!=', '=~', '!=~'];

const FilterButton = React.forwardRef<HTMLButtonElement, CustomControlProps<string>>(
  ({ value, isOpen, invalid, ...rest }, ref) => {
    return <Button {...rest} ref={ref} variant="secondary" icon="plus" aria-label="Add filter"></Button>;
  }
);
FilterButton.displayName = 'FilterButton';

const OperatorButton = React.forwardRef<HTMLButtonElement, CustomControlProps<string>>(({ value, ...rest }, ref) => {
  return (
    <Button {...rest} ref={ref} variant="secondary">
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
  const options = useMemo(
    () => [variableOptionGroup, ...labelsToGroupedOptions(Object.keys(labels))],
    [labels, variableOptionGroup]
  );

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
        {filters.map(({ key, operator, value, condition }, index) => {
          // Add the current key and value as options if they are manually entered
          const keyPresent = options.some((op) => {
            if (op.options) {
              return options.some((opp) => opp.label === key);
            }
            return op.label === key;
          });
          if (!keyPresent) {
            options.push({ label: key, value: key });
          }

          const valueOptions = labels.hasOwnProperty(key)
            ? [variableOptionGroup, ...labels[key].map(toOption)]
            : [variableOptionGroup];
          const valuePresent = valueOptions.some((op) => {
            return op.label === value;
          });
          if (!valuePresent) {
            valueOptions.push({ label: value, value });
          }

          return (
            <HorizontalGroup key={index} spacing="xs" width="auto">
              <Select
                menuShouldPortal
                aria-label="Filter label key"
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
                aria-label="Filter label value"
                width={SELECT_WIDTH}
                formatCreateLabel={(v) => `Use label value: ${v}`}
                allowCustomValue
                value={value}
                placeholder="add filter value"
                options={valueOptions}
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
          );
        })}
        {!filters.length && <AddFilter />}
      </VerticalGroup>
    </QueryEditorRow>
  );
};
