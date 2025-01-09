// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/LabelFilters.tsx
import { css, cx } from '@emotion/css';
import { isEqual } from 'lodash';
import { useEffect, useState } from 'react';

import { EditorField, EditorFieldGroup, EditorList } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { ComboboxOption, InlineFieldRow, InlineLabel } from '@grafana/ui';

import { QueryBuilderLabelFilter } from '../shared/types';

import { LabelFilterItem } from './LabelFilterItem';
import { LabelFilterItemCombobox } from './LabelFilterItemCombobox';

export const MISSING_LABEL_FILTER_ERROR_MESSAGE = 'Select at least 1 label filter (label and value)';

export interface LabelFiltersProps {
  labelsFilters: QueryBuilderLabelFilter[];
  onChange: (labelFilters: Array<Partial<QueryBuilderLabelFilter>>) => void;
  onGetLabelNames: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<ComboboxOption[]>;
  onGetLabelValues: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<ComboboxOption[]>;
  /** If set to true, component will show error message until at least 1 filter is selected */
  labelFilterRequired?: boolean;
  getLabelValuesAutofillSuggestions: (query: string, labelName?: string) => Promise<ComboboxOption[]>;
  debounceDuration: number;
  variableEditor?: boolean;
}

export function LabelFilters({
  labelsFilters,
  onChange,
  onGetLabelNames,
  onGetLabelValues,
  labelFilterRequired,
  getLabelValuesAutofillSuggestions,
  debounceDuration,
  variableEditor,
}: LabelFiltersProps) {
  const defaultOp = '=';
  const [items, setItems] = useState<Array<Partial<QueryBuilderLabelFilter>>>([{ op: defaultOp }]);

  useEffect(() => {
    if (labelsFilters.length > 0) {
      setItems(labelsFilters);
    } else {
      setItems([{ op: defaultOp }]);
    }
  }, [labelsFilters]);

  const onLabelsChange = (newItems: Array<Partial<QueryBuilderLabelFilter>>) => {
    setItems(newItems);

    // Extract full label filters with both label & value
    const newLabels = newItems.filter((x) => x.label != null && x.value != null);
    if (!isEqual(newLabels, labelsFilters)) {
      onChange(newLabels);
    }
  };

  const hasLabelFilter = items.some((item) => item.label && item.value);

  const editorList = () => {
    const anyIsMulti = items.some((item) => item.op === '=~' || item.op === '!~');
    const FilterItemComponent =
      config.featureToggles.prometheusUsesCombobox && !anyIsMulti ? LabelFilterItemCombobox : LabelFilterItem;

    return (
      <EditorList
        items={items}
        onChange={onLabelsChange}
        renderItem={(item: Partial<QueryBuilderLabelFilter>, onChangeItem, onDelete) => (
          <FilterItemComponent
            debounceDuration={debounceDuration}
            item={item}
            defaultOp={defaultOp}
            onChange={onChangeItem}
            onDelete={onDelete}
            onGetLabelNames={onGetLabelNames}
            onGetLabelValues={onGetLabelValues}
            invalidLabel={labelFilterRequired && !item.label}
            invalidValue={labelFilterRequired && !item.value}
            getLabelValuesAutofillSuggestions={getLabelValuesAutofillSuggestions}
          />
        )}
      />
    );
  };

  return (
    <>
      {variableEditor ? (
        <InlineFieldRow>
          <div
            className={cx(
              css({
                display: 'flex',
              })
            )}
          >
            <InlineLabel
              width={20}
              tooltip={<div>Optional: used to filter the metric select for this query type.</div>}
            >
              Label filters
            </InlineLabel>
            {editorList()}
          </div>
        </InlineFieldRow>
      ) : (
        <EditorFieldGroup>
          <EditorField
            label="Label filters"
            error={MISSING_LABEL_FILTER_ERROR_MESSAGE}
            invalid={labelFilterRequired && !hasLabelFilter}
          >
            {editorList()}
          </EditorField>
        </EditorFieldGroup>
      )}
    </>
  );
}
