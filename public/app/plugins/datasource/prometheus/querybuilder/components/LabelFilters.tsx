import EditorField from 'app/plugins/datasource/cloudwatch/components/ui/EditorField';
import EditorFieldGroup from 'app/plugins/datasource/cloudwatch/components/ui/EditorFieldGroup';
import EditorList from 'app/plugins/datasource/cloudwatch/components/ui/EditorList';
import { isEqual } from 'lodash';
import React, { useState } from 'react';
import { PrometheusDatasource } from '../../datasource';
import { QueryBuilderLabelFilter } from '../shared/types';
import { PromVisualQuery } from '../types';
import { LabelFilterItem } from './LabelFilterItem';

export interface Props {
  query: PromVisualQuery;
  onChange: (query: PromVisualQuery) => void;
  datasource: PrometheusDatasource;
}

export function LabelFilters({ query, onChange, datasource }: Props) {
  const [items, setItems] = useState<Array<Partial<QueryBuilderLabelFilter>>>(query.labels);

  const onLabelsChange = (newItems: Array<Partial<QueryBuilderLabelFilter>>) => {
    setItems(newItems);

    // Extract full label filters with both label & value
    const newLabels = newItems.filter((x) => x.label != null && x.value != null);
    if (!isEqual(newLabels, query.labels)) {
      onChange({ ...query, labels: newLabels as QueryBuilderLabelFilter[] });
    }
  };

  return (
    <EditorFieldGroup>
      <EditorField label="Labels">
        <EditorList items={items} onChange={onLabelsChange} renderItem={getLabelFilterRenderer(query, datasource)} />
      </EditorField>
    </EditorFieldGroup>
  );
}

function getLabelFilterRenderer(query: PromVisualQuery, datasource: PrometheusDatasource) {
  function renderFilter(
    item: Partial<QueryBuilderLabelFilter>,
    onChange: (item: QueryBuilderLabelFilter) => void,
    onDelete: () => void
  ) {
    return (
      <LabelFilterItem
        item={item}
        onChange={(item) => onChange(item)}
        datasource={datasource}
        query={query}
        onDelete={onDelete}
      />
    );
  }

  return renderFilter;
}
