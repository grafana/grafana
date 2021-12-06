import EditorField from 'app/plugins/datasource/cloudwatch/components/ui/EditorField';
import EditorFieldGroup from 'app/plugins/datasource/cloudwatch/components/ui/EditorFieldGroup';
import EditorList from 'app/plugins/datasource/cloudwatch/components/ui/EditorList';
import { isEqual } from 'lodash';
import React, { useState } from 'react';
import { QueryBuilderLabelFilter } from '../shared/types';
import { LabelFilterItem } from './LabelFilterItem';

export interface Props {
  labelsFilters: QueryBuilderLabelFilter[];
  onGetLabelNames: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<string[]>;
  onGetLabelNameValues: (forLabel: Partial<QueryBuilderLabelFilter>) => Promise<string[]>;
  onChange: (labelFilters: QueryBuilderLabelFilter[]) => void;
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

function getLabelFilterRenderer({ onGetLabelNames, onGetLabelNameValues }: Props) {
  function renderFilter(
    item: Partial<QueryBuilderLabelFilter>,
    onChange: (item: QueryBuilderLabelFilter) => void,
    onDelete: () => void
  ) {
    return (
      <LabelFilterItem
        item={item}
        onChange={(item) => onChange(item)}
        onDelete={onDelete}
        onGetLabelNames={onGetLabelNames}
        onGetLabelNameValues={onGetLabelNameValues}
      />
    );
  }

  return renderFilter;
}
