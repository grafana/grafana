import React from 'react';
import { LokiVisualQuery } from '../types';
import EditorRows from 'app/plugins/datasource/cloudwatch/components/ui/EditorRows';
import EditorRow from 'app/plugins/datasource/cloudwatch/components/ui/EditorRow';
import { LokiDatasource } from '../../datasource';
import { LabelFilters } from 'app/plugins/datasource/prometheus/querybuilder/shared/LabelFilters';
import { OperationList } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationList';
import { QueryBuilderLabelFilter } from 'app/plugins/datasource/prometheus/querybuilder/shared/types';
import { lokiQueryModeller } from '../lokiQueryModeller';

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
        <OperationList engine={lokiQueryModeller} query={query} onChange={onChange} />
      </EditorRow>
    </EditorRows>
  );
});

LokiQueryBuilderInner.displayName = 'LokiQueryBuilderInner';
