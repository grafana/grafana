// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/LabelFilterItem.tsx
import { useCallback, useRef } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { AccessoryButton, InputGroup } from '@grafana/experimental';
import { Combobox, ComboboxOption } from '@grafana/ui';

import { QueryBuilderLabelFilter } from '../shared/types';

function toComboboxOption(value: string): ComboboxOption {
  return { value };
}

export interface LabelFilterItemProps {
  defaultOp: string;
  item: Partial<QueryBuilderLabelFilter>;
  onChange: (value: QueryBuilderLabelFilter) => void;
  onGetLabelNames: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<ComboboxOption[]>;
  onGetLabelValues: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<ComboboxOption[]>;
  onDelete: () => void;
  invalidLabel?: boolean;
  invalidValue?: boolean;
  getLabelValuesAutofillSuggestions: (query: string, labelName?: string) => Promise<SelectableValue[]>;
  debounceDuration: number;
}

export function LabelFilterItemCombobox({
  item,
  defaultOp,
  onChange,
  onDelete,
  onGetLabelNames,
  onGetLabelValues,
  invalidLabel,
  invalidValue,
  getLabelValuesAutofillSuggestions,
}: LabelFilterItemProps) {
  const isMultiSelect = (operator = item.op) => {
    return operators.find((op) => op.label === operator)?.isMultiValue;
  };

  const getSelectOptionsFromString = (item?: string): string[] => {
    if (item) {
      const regExp = /\(([^)]+)\)/;
      const matches = item.match(regExp);

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

  const itemValue = item?.value ?? '';

  // TODO: should the first item in the tuple, the cache key, be item.label (string) instead?
  type PrevOptions = [typeof item, ComboboxOption[]];
  const labelNamesRef = useRef<PrevOptions>();
  const loadLabelNames = useCallback(
    async (query: string): Promise<Array<ComboboxOption<string>>> => {
      const [prevItem, prevLabelNames] = labelNamesRef.current ?? [];

      // This function is called on each key press, but the GetLabelNames API doesn't support filtering.
      // We lazily request the label names and then cache it for the each time the user types.
      const labelNames = prevItem === item && prevLabelNames ? prevLabelNames : await onGetLabelNames(item);
      labelNamesRef.current = [item, labelNames];

      return labelNames.filter((label) => label.value.includes(query));
    },
    [item, onGetLabelNames]
  );

  const labelValuesRef = useRef<PrevOptions>();
  const loadLabelValues = useCallback(
    async (query: string): Promise<Array<ComboboxOption<string>>> => {
      const [prevItem, prevLabelValues] = labelValuesRef.current ?? [];

      // PR TODO: incomplete logic not copied from LabelFilterItem.tsx.
      // I think we need to:
      // - when query is empty, call onGetLabelValues
      // - when we have a query, call getLabelValuesAutofillSuggestions(query, item.label)

      // This function is called on each key press, but the GetLabelNames API doesn't support filtering.
      // We lazily request the label names and then cache it for the each time the user types.
      const labelValues = prevItem === item && prevLabelValues ? prevLabelValues : await onGetLabelValues(item);
      labelValuesRef.current = [item, labelValues];

      return labelValues.filter((label) => label.value.includes(query));
    },
    [item, onGetLabelValues]
  );

  if (isMultiSelect() && itemValue) {
    return <div>multi select is not supported with combobox yet</div>;
  }

  return (
    <div key={itemValue} data-testid="prometheus-dimensions-filter-item">
      <InputGroup>
        {/* Label name select, loads all values at once */}
        <Combobox
          placeholder="Select label"
          data-testid={selectors.components.QueryBuilder.labelSelect}
          // inputId="prometheus-dimensions-filter-item-key"
          width="auto"
          minWidth={4} // PR TODO: check this
          value={item.label ?? null}
          createCustomValue
          options={loadLabelNames}
          onChange={(change) => {
            onChange({
              ...item,
              op: item.op ?? defaultOp,
              label: change.value,

              // PR TODO: optional?
              value: item.value ?? '',
            });
          }}
          invalid={invalidLabel}
        />

        {/* Operator select i.e.   = =~ != !~   */}
        <Combobox
          data-testid={selectors.components.QueryBuilder.matchOperatorSelect}
          value={item.op ?? defaultOp}
          options={operators}
          width="auto"
          minWidth={4} // PR TODO: check this
          onChange={(change) => {
            onChange({
              ...item,
              op: change.value,
              // PR TODO: optional?
              value: (isMultiSelect(change.value) ? item.value : getSelectOptionsFromString(item?.value)[0]) ?? '',
              // PR TODO: optional?
              label: item.label ?? '',
            });
          }}
        />

        {/* Label value async select: autocomplete calls prometheus API */}

        <Combobox
          placeholder="Select value"
          data-testid={selectors.components.QueryBuilder.valueSelect}
          // inputId="prometheus-dimensions-filter-item-value"
          width="auto"
          minWidth={4} // PR TODO: check this
          // TODO: isMulti() check would be put back here
          value={getSelectOptionsFromString(itemValue).map(toComboboxOption)[0]}
          createCustomValue
          options={loadLabelValues}
          onChange={(change) => {
            onChange({
              ...item,
              value: change.value,
              op: item.op ?? defaultOp,
              // PR TODO: optional?
              label: item.label ?? '',
            });
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
