// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/LabelFilterItem.tsx
import debounce from 'debounce-promise';
import { useState } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { AccessoryButton, InputGroup } from '@grafana/plugin-ui';
import { AsyncSelect, Select } from '@grafana/ui';

import { truncateResult } from '../../language_utils';
import { QueryBuilderLabelFilter } from '../shared/types';

export interface LabelFilterItemProps {
  defaultOp: string;
  item: Partial<QueryBuilderLabelFilter>;
  onChange: (value: QueryBuilderLabelFilter) => void;
  onGetLabelNames: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<SelectableValue[]>;
  onGetLabelValues: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<SelectableValue[]>;
  onDelete: () => void;
  invalidLabel?: boolean;
  invalidValue?: boolean;
  getLabelValuesAutofillSuggestions: (query: string, labelName?: string) => Promise<SelectableValue[]>;
  debounceDuration: number;
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
  getLabelValuesAutofillSuggestions,
  debounceDuration,
}: LabelFilterItemProps) {
  const [state, setState] = useState<{
    labelNames?: SelectableValue[];
    labelValues?: SelectableValue[];
    isLoadingLabelNames?: boolean;
    isLoadingLabelValues?: boolean;
  }>({});
  // there's a bug in react-select where the menu doesn't recalculate its position when the options are loaded asynchronously
  // see https://github.com/grafana/grafana/issues/63558
  // instead, we explicitly control the menu visibility and prevent showing it until the options have fully loaded
  const [labelNamesMenuOpen, setLabelNamesMenuOpen] = useState(false);
  const [labelValuesMenuOpen, setLabelValuesMenuOpen] = useState(false);
  const [allLabels, setAllLabels] = useState<SelectableValue[]>([]);

  const isMultiSelect = (operator = item.op) => {
    return operators.find((op) => op.label === operator)?.isMultiValue;
  };

  const getSelectOptionsFromString = (item?: string): string[] => {
    if (item) {
      const regExp = /\(([^)]+)\)/;
      const matches = item?.match(regExp);

      if (matches && matches[0].indexOf('|') > 0) {
        return [item];
      }

      if (item.indexOf('|') > 0) {
        return item.split('|');
      }
      return [item];
    }
    return [];
  };

  const labelValueSearch = debounce(
    (query: string) => getLabelValuesAutofillSuggestions(query, item.label),
    debounceDuration
  );

  /**
   * Debounce a search through all the labels possible and truncate by .
   */
  const labelNamesSearch = debounce((query: string) => {
    // we limit the select to show 1000 options,
    // but we still search through all the possible options
    const results = allLabels.filter((label) => {
      return label.value.includes(query);
    });
    return truncateResult(results);
  }, debounceDuration);

  const itemValue = item?.value ?? '';

  return (
    <div key={itemValue} data-testid="prometheus-dimensions-filter-item">
      <InputGroup>
        {/* Label name select, loads all values at once */}
        <AsyncSelect
          placeholder="Select label"
          data-testid={selectors.components.QueryBuilder.labelSelect}
          inputId="prometheus-dimensions-filter-item-key"
          width="auto"
          value={item.label ? toOption(item.label) : null}
          allowCustomValue
          onOpenMenu={async () => {
            setState({ isLoadingLabelNames: true });
            const labelNames = await onGetLabelNames(item);
            // store all label names to allow for full label searching by typing in the select option, see loadOptions function labelNamesSearch
            setAllLabels(labelNames);
            setLabelNamesMenuOpen(true);
            // truncate the results the same amount as the metric select
            const truncatedLabelNames = truncateResult(labelNames);
            setState({ labelNames: truncatedLabelNames, isLoadingLabelNames: undefined });
          }}
          onCloseMenu={() => {
            setLabelNamesMenuOpen(false);
          }}
          isOpen={labelNamesMenuOpen}
          isLoading={state.isLoadingLabelNames ?? false}
          loadOptions={labelNamesSearch}
          defaultOptions={state.labelNames}
          onChange={(change) => {
            if (change.label) {
              onChange({
                ...item,
                op: item.op ?? defaultOp,
                label: change.label,
                // eslint-ignore
              } as QueryBuilderLabelFilter);
            }
          }}
          invalid={invalidLabel}
        />

        {/* Operator select i.e.   = =~ != !~   */}
        <Select
          data-testid={selectors.components.QueryBuilder.matchOperatorSelect}
          className="query-segment-operator"
          value={toOption(item.op ?? defaultOp)}
          options={operators}
          width="auto"
          onChange={(change) => {
            if (change.value != null) {
              onChange({
                ...item,
                op: change.value,
                value: isMultiSelect(change.value) ? item.value : getSelectOptionsFromString(item?.value)[0],
                // eslint-ignore
              } as QueryBuilderLabelFilter);
            }
          }}
        />

        {/* Label value async select: autocomplete calls prometheus API */}
        <AsyncSelect
          placeholder="Select value"
          data-testid={selectors.components.QueryBuilder.valueSelect}
          inputId="prometheus-dimensions-filter-item-value"
          width="auto"
          value={
            isMultiSelect()
              ? getSelectOptionsFromString(itemValue).map(toOption)
              : getSelectOptionsFromString(itemValue).map(toOption)[0]
          }
          allowCustomValue
          formatCreateLabel={(input) => input} // to avoid confusion, opt out of using the `defaultFormatCreateLabel`
          createOptionPosition={item.op?.includes('~') ? 'first' : 'last'}
          onOpenMenu={async () => {
            setState({ isLoadingLabelValues: true });
            const labelValues = await onGetLabelValues(item);
            truncateResult(labelValues);
            setLabelValuesMenuOpen(true);
            setState({
              ...state,
              labelValues,
              isLoadingLabelValues: undefined,
            });
          }}
          onCloseMenu={() => {
            setLabelValuesMenuOpen(false);
          }}
          isOpen={labelValuesMenuOpen}
          defaultOptions={state.labelValues}
          isMulti={isMultiSelect()}
          isLoading={state.isLoadingLabelValues}
          loadOptions={labelValueSearch}
          onChange={(change) => {
            if (change.value) {
              onChange({
                ...item,
                value: change.value,
                op: item.op ?? defaultOp,
                // eslint-ignore
              } as QueryBuilderLabelFilter);
            } else {
              const changes = change
                .map((change: { label?: string }) => {
                  return change.label;
                })
                .join('|');
              // eslint-ignore
              onChange({ ...item, value: changes, op: item.op ?? defaultOp } as QueryBuilderLabelFilter);
            }
          }}
          invalid={invalidValue}
        />
        <AccessoryButton aria-label={`remove-${item.label}`} icon="times" variant="secondary" onClick={onDelete} />
      </InputGroup>
    </div>
  );
}

const operators = [
  { label: '=', value: '=', isMultiValue: false },
  { label: '!=', value: '!=', isMultiValue: false },
  { label: '=~', value: '=~', isMultiValue: true },
  { label: '!~', value: '!~', isMultiValue: true },
];
