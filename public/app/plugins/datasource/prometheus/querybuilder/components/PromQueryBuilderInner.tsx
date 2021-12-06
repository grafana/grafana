import React from 'react';
import { MetricSelect } from './MetricSelect';
import { PromVisualQuery } from '../types';
import { LabelFilters } from '../shared/LabelFilters';
import { OperationList } from '../shared/OperationList';
import EditorRows from 'app/plugins/datasource/cloudwatch/components/ui/EditorRows';
import EditorRow from 'app/plugins/datasource/cloudwatch/components/ui/EditorRow';
import { PrometheusDatasource } from '../../datasource';
import { NestedQueryList } from './NestedQueryList';
import { visualQueryEngine } from '../engine';
import { QueryBuilderLabelFilter } from '../shared/types';

export interface Props {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromVisualQuery) => void;
  isNested?: boolean;
}

export const PromQueryBuilderInner = React.memo<Props>(({ datasource, query, onChange }) => {
  const onChangeLabels = (labels: QueryBuilderLabelFilter[]) => {
    onChange({ ...query, labels });
  };

  const onGetLabelNames = async (forLabel: Partial<QueryBuilderLabelFilter>) => {
    return (await datasource.metricFindQuery('label_names()')).map((x) => x.text);
  };

  return (
    <EditorRows>
      <EditorRow>
        <MetricSelect query={query} onChange={onChange} />
      </EditorRow>
      <EditorRow>
        <LabelFilters onGetLabelNames={onGetLabelNames} labelsFilters={query.labels} onChange={onChangeLabels} />
      </EditorRow>
      <EditorRow>
        <OperationList engine={visualQueryEngine} query={query} onChange={onChange} />
        {query.binaryQueries && query.binaryQueries.length > 0 && (
          <NestedQueryList query={query} datasource={datasource} onChange={onChange} />
        )}
      </EditorRow>
    </EditorRows>
  );
});

PromQueryBuilderInner.displayName = 'PromQueryBuilderInner';
