import React, { FunctionComponent, useMemo } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { AccessoryButton, EditorField, EditorList, EditorRow } from '@grafana/experimental';
import { HorizontalGroup, Select } from '@grafana/ui';

import { labelsToGroupedOptions, stringArrayToFilters } from '../functions';

export interface Props {
  labels: { [key: string]: string[] };
  filters: string[];
  onChange: (filters: string[]) => void;
  variableOptionGroup: SelectableValue<string>;
}

interface Filter {
  key: string;
  operator: string;
  value: string;
  condition: string;
}

const DEFAULT_OPERATOR = '=';
const DEFAULT_CONDITION = 'AND';

const filtersToStringArray = (filters: Filter[]) =>
  filters.flatMap(({ key, operator, value, condition }) => [key, operator, value, condition]).slice(0, -1);

const operators = ['=', '!=', '=~', '!=~'].map(toOption);

// These keys are not editable as labels but they have its own selector.
// For example the 'metric.type' is set with the metric name selector.
const protectedFilterKeys = ['metric.type'];

export const LabelFilter: FunctionComponent<Props> = ({
  labels = {},
  filters: filterArray,
  onChange: _onChange,
  variableOptionGroup,
}) => {
  const rawFilters: Filter[] = stringArrayToFilters(filterArray);
  const filters = rawFilters.filter(({ key }) => !protectedFilterKeys.includes(key));
  const protectedFilters = rawFilters.filter(({ key }) => protectedFilterKeys.includes(key));

  const options = useMemo(
    () => [variableOptionGroup, ...labelsToGroupedOptions(Object.keys(labels))],
    [labels, variableOptionGroup]
  );

  const getOptions = ({ key = '', value = '' }: Partial<Filter>) => {
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
    const valuePresent = valueOptions.some((op) => op.label === value);
    if (!valuePresent) {
      valueOptions.push({ label: value, value });
    }

    return { options, valueOptions };
  };

  const onChange = (items: Array<Partial<Filter>>) => {
    const filters = items.concat(protectedFilters).map(({ key, operator, value, condition }) => ({
      key: key || '',
      operator: operator || DEFAULT_OPERATOR,
      value: value || '',
      condition: condition || DEFAULT_CONDITION,
    }));
    _onChange(filtersToStringArray(filters));
  };

  const renderItem = (item: Partial<Filter>, onChangeItem: (item: Filter) => void, onDeleteItem: () => void) => {
    const { key = '', operator = DEFAULT_OPERATOR, value = '', condition = DEFAULT_CONDITION } = item;
    const { options, valueOptions } = getOptions(item);

    return (
      <HorizontalGroup spacing="xs" width="auto">
        <Select
          aria-label="Filter label key"
          formatCreateLabel={(v) => `Use label key: ${v}`}
          allowCustomValue
          value={key}
          options={options}
          onChange={({ value: key = '' }) => onChangeItem({ key, operator, value, condition })}
        />
        <Select
          value={operator}
          options={operators}
          onChange={({ value: operator = DEFAULT_OPERATOR }) => onChangeItem({ key, operator, value, condition })}
        />
        <Select
          aria-label="Filter label value"
          placeholder="add filter value"
          formatCreateLabel={(v) => `Use label value: ${v}`}
          allowCustomValue
          value={value}
          options={valueOptions}
          onChange={({ value = '' }) => onChangeItem({ key, operator, value, condition })}
        />
        <AccessoryButton aria-label="Remove" icon="times" variant="secondary" onClick={onDeleteItem} type="button" />
      </HorizontalGroup>
    );
  };

  return (
    <EditorRow>
      <EditorField
        label="Filter"
        tooltip="To reduce the amount of data charted, apply a filter. A filter has three components: a label, a comparison, and a value. The comparison can be an equality, inequality, or regular expression."
      >
        <EditorList items={filters} renderItem={renderItem} onChange={onChange} />
      </EditorField>
    </EditorRow>
  );
};
