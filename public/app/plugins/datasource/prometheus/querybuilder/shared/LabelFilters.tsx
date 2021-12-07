import { EditorField, EditorFieldGroup, EditorList } from '@grafana/experimental';
import { isEqual } from 'lodash';
import React, { useState } from 'react';
import { QueryBuilderLabelFilter } from '../shared/types';
import { LabelFilterItem } from './LabelFilterItem';

export interface Props {
  labelsFilters: QueryBuilderLabelFilter[];
  labelData: any;
  onChange: (labelFilters: QueryBuilderLabelFilter[]) => void;
  onGetLabelValues: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<string[]>;
}

export function LabelFilters(props: Props) {
  const { labelsFilters, onChange } = props;
  const [items, setItems] = useState<Array<Partial<QueryBuilderLabelFilter>>>(labelsFilters);

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
        <EditorList items={items} onChange={onLabelsChange} renderItem={getLabelFilterRenderer(props)} />
      </EditorField>
    </EditorFieldGroup>
  );
}

function getLabelFilterRenderer({ labelData, onGetLabelValues }: Props) {
  function renderFilter(
    item: Partial<QueryBuilderLabelFilter>,
    onChange: (item: QueryBuilderLabelFilter) => void,
    onDelete: () => void
  ) {
    return (
      <LabelFilterItem
        item={item}
        labelData={labelData}
        onChange={(item) => onChange(item)}
        onDelete={onDelete}
        onGetLabelValues={onGetLabelValues}
      />
    );
  }

  return renderFilter;
}
