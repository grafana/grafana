import React from 'react';
import { LokiVisualQuery } from '../types';
import { LokiDatasource } from '../../datasource';
import { LabelFilters } from 'app/plugins/datasource/prometheus/querybuilder/shared/LabelFilters';
import { OperationList } from 'app/plugins/datasource/prometheus/querybuilder/shared/OperationList';
import { QueryBuilderLabelFilter } from 'app/plugins/datasource/prometheus/querybuilder/shared/types';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { DataSourceApi } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow, EditorRows } from '@grafana/experimental';
import { Input } from '@grafana/ui';
import { QueryPreview } from './QueryPreview';

export interface Props {
  query: LokiVisualQuery;
  datasource: LokiDatasource;
  onChange: (update: LokiVisualQuery) => void;
  isNested?: boolean;
}

export const LokiQueryBuilder = React.memo<Props>(({ datasource, query, isNested, onChange }) => {
  const onChangeLabels = (labels: QueryBuilderLabelFilter[]) => {
    onChange({ ...query, labels });
  };

  const onGetLabelNames = async (forLabel: Partial<QueryBuilderLabelFilter>): Promise<any> => {
    const labelsToConsider = query.labels.filter((x) => x !== forLabel);
    const expr = lokiQueryModeller.renderLabels(labelsToConsider);
    return await datasource.languageProvider.fetchSeriesLabels(expr);
  };

  const onGetLabelValues = async (forLabel: Partial<QueryBuilderLabelFilter>) => {
    return (await datasource.metricFindQuery('label_values(' + forLabel.label + ')')).map((x: any) => x.text);
  };

  return (
    <EditorRows>
      <EditorRow>
        <LabelFilters
          onGetLabelNames={onGetLabelNames}
          onGetLabelValues={onGetLabelValues}
          labelsFilters={query.labels}
          onChange={onChangeLabels}
        />
      </EditorRow>
      <EditorRow>
        <EditorFieldGroup>
          <EditorField label="Search">
            <Input width={50} />
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>
      <EditorRow>
        <OperationList
          queryModeller={lokiQueryModeller}
          query={query}
          onChange={onChange}
          datasource={datasource as DataSourceApi}
        />
      </EditorRow>
      {!isNested && (
        <EditorRow>
          <QueryPreview query={query} />
        </EditorRow>
      )}
    </EditorRows>
  );
});

LokiQueryBuilder.displayName = 'LokiQueryBuilder';
