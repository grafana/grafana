import EditorField from 'app/plugins/datasource/cloudwatch/components/ui/EditorField';
import EditorFieldGroup from 'app/plugins/datasource/cloudwatch/components/ui/EditorFieldGroup';
import EditorList from 'app/plugins/datasource/cloudwatch/components/ui/EditorList';
import { isEqual } from 'lodash';
import React, { useState } from 'react';
import { QueryBuilderLabelFilter } from '../shared/types';
import { LabelFilterItem } from './LabelFilterItem';

export interface Props {
  labelsFilters: QueryBuilderLabelFilter[];
  onChange: (labelFilters: QueryBuilderLabelFilter[]) => void;
}

export function LabelFilters({ labelsFilters, onChange }: Props) {
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
        <EditorList items={items} onChange={onLabelsChange} renderItem={getLabelFilterRenderer()} />
      </EditorField>
    </EditorFieldGroup>
  );
}

function getLabelFilterRenderer() {
  function renderFilter(
    item: Partial<QueryBuilderLabelFilter>,
    onChange: (item: QueryBuilderLabelFilter) => void,
    onDelete: () => void
  ) {
    return <LabelFilterItem item={item} onChange={(item) => onChange(item)} onDelete={onDelete} />;
  }

  return renderFilter;
}
