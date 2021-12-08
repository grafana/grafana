import { EditorField, EditorFieldGroup, EditorList } from '@grafana/experimental';
import { isEqual } from 'lodash';
import React, { useState } from 'react';
import { QueryBuilderLabelFilter } from '../shared/types';
import { LabelFilterItem } from './LabelFilterItem';

export interface Props {
  labelsFilters: QueryBuilderLabelFilter[];
  onChange: (labelFilters: QueryBuilderLabelFilter[]) => void;
  onGetLabelNames: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<string[]>;
  onGetLabelValues: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<string[]>;
}

export function LabelFilters({ labelsFilters, onChange, onGetLabelNames, onGetLabelValues }: Props) {
  const defaultOp = '=';
  const [items, setItems] = useState<Array<Partial<QueryBuilderLabelFilter>>>(
    labelsFilters.length === 0 ? [{ op: defaultOp }] : labelsFilters
  );

  const onLabelsChange = (newItems: Array<Partial<QueryBuilderLabelFilter>>) => {
    setItems(newItems);

    // Extract full label filters with both label & value
    const newLabels = newItems.filter((x) => x.label != null && x.value != null);
    if (!isEqual(newLabels, labelsFilters)) {
      onChange(newLabels as QueryBuilderLabelFilter[]);
    }
  };

  return (
    <EditorFieldGroup>
      <EditorField label="Labels">
        <EditorList
          items={items}
          onChange={onLabelsChange}
          renderItem={(item, onChangeItem, onDelete) => (
            <LabelFilterItem
              item={item}
              defaultOp={defaultOp}
              onChange={onChangeItem}
              onDelete={onDelete}
              onGetLabelNames={onGetLabelNames}
              onGetLabelValues={onGetLabelValues}
            />
          )}
        />
      </EditorField>
    </EditorFieldGroup>
  );
}
