import { debounce } from 'lodash';
import React, {useEffect, useState} from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { AccessoryButton, InputGroup } from '@grafana/experimental';
import { AsyncSelect, Select } from '@grafana/ui';

import { QueryBuilderLabelFilter } from './types';
import {PROMETHEUS_QUERY_BUILDER_MAX_RESULTS} from "../components/MetricSelect";

export interface Props {
  defaultOp: string;
  item: Partial<QueryBuilderLabelFilter>;
  onChange: (value: QueryBuilderLabelFilter) => void;
  onGetLabelNames: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<SelectableValue[]>;
  onGetLabelValues: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<SelectableValue[]>;
  onDelete: () => void;
  invalidLabel?: boolean;
  invalidValue?: boolean;
  getLabelValues: (query: string, labelName?: string) => Promise<SelectableValue[]>;
}

export function LabelFilterItem({
  item,
  defaultOp,
  onChange,
  onDelete,
  onGetLabelNames,
  onGetLabelValues,
  invalidLabel,
  invalidValue,
  getLabelValues,
}: Props) {
  const [state, setState] = useState<{
    labelNames?: SelectableValue[];
    labelValues?: SelectableValue[];
    isLoadingLabelNames?: boolean;
    isLoadingLabelValues?: boolean;
  }>({});

  const isMultiSelect = (operator = item.op) => {
    return operators.find((op) => op.label === operator)?.isMultiValue;
  };

  useEffect(() => {
    console.log('loading state change', state.isLoadingLabelValues)
  }, [state.isLoadingLabelValues])

  useEffect(() => {
    console.log('query state change', query)
  }, [state.isLoadingLabelValues])

  const getSelectOptionsFromString = (item?: string): string[] => {
    if (item) {
      if (item.indexOf('|') > 0) {
        return item.split('|');
      }
      return [item];
    }
    return [];
  };

  // const getOptions = (): SelectableValue[] => {
  //   const labelValues = state.labelValues ? [...state.labelValues] : [];
  //   const selectedOptions = getSelectOptionsFromString(item?.value).map(toOption);
  //
  //   // Remove possible duplicated values
  //   return uniqBy([...selectedOptions, ...labelValues], 'value');
  // };

  // const getLabelValuesHelper = (query: string, label?: string): Promise<Array<SelectableValue>> => {
  //   const response = getLabelValues(query, label);
  //
  //   return response.then((results) => {
  //     if (results.length > PROMETHEUS_QUERY_BUILDER_MAX_RESULTS) {
  //       results.splice(0, results.length - PROMETHEUS_QUERY_BUILDER_MAX_RESULTS);
  //     }
  //     return results;
  //   });
  // };

  const labelValueSearch = debounce((query: string) => getLabelValues(query, item.label), 350);

  return (
    <div data-testid="prometheus-dimensions-filter-item">
      <InputGroup>
        <Select
          placeholder="Select label"
          aria-label={selectors.components.QueryBuilder.labelSelect}
          inputId="prometheus-dimensions-filter-item-key"
          width="auto"
          value={item.label ? toOption(item.label) : null}
          allowCustomValue
          onOpenMenu={async () => {
            setState({ isLoadingLabelNames: true });
            const labelNames = await onGetLabelNames(item);
            setState({ labelNames, isLoadingLabelNames: undefined });
          }}
          isLoading={state.isLoadingLabelNames ?? false}
          options={state.labelNames}
          onChange={(change) => {
            if (change.label) {
              onChange({
                ...item,
                op: item.op ?? defaultOp,
                label: change.label,
              } as unknown as QueryBuilderLabelFilter);
            }
          }}
          invalid={invalidLabel}
        />

        <Select
          aria-label={selectors.components.QueryBuilder.matchOperatorSelect}
          value={toOption(item.op ?? defaultOp)}
          options={operators}
          width="auto"
          onChange={(change) => {
            if (change.value != null) {
              onChange({
                ...item,
                op: change.value,
                value: isMultiSelect(change.value) ? item.value : getSelectOptionsFromString(item?.value)[0],
              } as unknown as QueryBuilderLabelFilter);
            }
          }}
        />

        <AsyncSelect
          placeholder="Select value"
          aria-label={selectors.components.QueryBuilder.valueSelect}
          inputId="prometheus-dimensions-filter-item-value"
          width="auto"
          value={
            isMultiSelect()
              ? getSelectOptionsFromString(item?.value).map(toOption)
              : getSelectOptionsFromString(item?.value).map(toOption)[0]
          }
          allowCustomValue
          onOpenMenu={async () => {
            setState({ isLoadingLabelValues: true });
            const labelValues = await onGetLabelValues(item);
            if (labelValues.length > PROMETHEUS_QUERY_BUILDER_MAX_RESULTS) {
              labelValues.splice(0, labelValues.length - PROMETHEUS_QUERY_BUILDER_MAX_RESULTS);
            }
            setState({
              ...state,
              labelValues,
              isLoadingLabelValues: undefined,
            });
          }}
          defaultOptions={state.labelValues}
          isMulti={isMultiSelect()}
          isLoading={state.isLoadingLabelValues}

          // options={getOptions()}
          loadOptions={labelValueSearch}
          onChange={(change) => {
            if (change.value) {
              onChange({
                ...item,
                value: change.value,
                op: item.op ?? defaultOp,
              } as unknown as QueryBuilderLabelFilter);
            } else {
              const changes = change
                .map((change: any) => {
                  return change.label;
                })
                .join('|');
              onChange({ ...item, value: changes, op: item.op ?? defaultOp } as unknown as QueryBuilderLabelFilter);
            }
          }}
          invalid={invalidValue}
        />
        <AccessoryButton aria-label="remove" icon="times" variant="secondary" onClick={onDelete} />
      </InputGroup>
    </div>
  );
}

const operators = [
  { label: '=~', value: '=~', isMultiValue: true },
  { label: '=', value: '=', isMultiValue: false },
  { label: '!=', value: '!=', isMultiValue: false },
  { label: '!~', value: '!~', isMultiValue: true },
];
