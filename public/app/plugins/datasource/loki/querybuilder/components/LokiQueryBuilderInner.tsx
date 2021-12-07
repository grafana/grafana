import React from 'react';
import { LokiVisualQuery } from '../types';
import { LokiDatasource } from '../../datasource';
import { LabelFilters } from 'app/plugins/datasource/prometheus/querybuilder/shared/LabelFilters';
import { OperationList } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationList';
import { QueryBuilderLabelFilter } from 'app/plugins/datasource/prometheus/querybuilder/shared/types';
import { lokiQueryModeller } from '../lokiQueryModeller';
import { DataSourceApi } from '@grafana/data';
import { EditorRow, EditorRows } from '@grafana/experimental';

export interface Props {
  query: LokiVisualQuery;
  datasource: LokiDatasource;
  onChange: (update: LokiVisualQuery) => void;
  isNested?: boolean;
}

export const LokiQueryBuilderInner = React.memo<Props>(({ datasource, query, onChange }) => {
  const onChangeLabels = (labels: QueryBuilderLabelFilter[]) => {
    onChange({ ...query, labels });
  };

  return (
    <EditorRows>
      <EditorRow>
        <LabelFilters labelsFilters={query.labels} onChange={onChangeLabels} />
      </EditorRow>
      <EditorRow>Simple search</EditorRow>
      <EditorRow>
        <OperationList
          queryModeller={lokiQueryModeller}
          query={query}
          onChange={onChange}
          datasource={datasource as DataSourceApi}
        />
      </EditorRow>
    </EditorRows>
  );
});

LokiQueryBuilderInner.displayName = 'LokiQueryBuilderInner';
