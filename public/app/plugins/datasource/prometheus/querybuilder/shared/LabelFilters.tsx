import { isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorFieldGroup, EditorField, EditorList } from '@grafana/ui';

import { QueryBuilderLabelFilter } from '../shared/types';

import { LabelFilterItem } from './LabelFilterItem';

export interface Props {
  labelsFilters: QueryBuilderLabelFilter[];
  onChange: (labelFilters: QueryBuilderLabelFilter[]) => void;
  onGetLabelNames: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<SelectableValue[]>;
  onGetLabelValues: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<SelectableValue[]>;
  error?: string;
}

export function LabelFilters({ labelsFilters, onChange, onGetLabelNames, onGetLabelValues, error }: Props) {
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
      onChange(newLabels as QueryBuilderLabelFilter[]);
    }
  };

  return (
    <EditorFieldGroup>
      <EditorField label="Label filters" error={error} invalid={!!error}>
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
