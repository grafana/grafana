import React, { useState } from 'react';
import { MetricSelect } from './MetricSelect';
import { PromVisualQuery } from '../types';
import { LabelFilters } from '../shared/LabelFilters';
import { OperationList } from '../shared/OperationList';
import { EditorRows, EditorRow } from '@grafana/experimental';
import { PrometheusDatasource } from '../../datasource';
import { NestedQueryList } from './NestedQueryList';
import { promQueryModeller } from '../PromQueryModeller';
import { QueryBuilderLabelFilter } from '../shared/types';
import { QueryPreview } from './QueryPreview';
import { DataSourceApi } from '@grafana/data';

export interface Props {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromVisualQuery) => void;
  isNested?: boolean;
}

export const PromQueryBuilderInner = React.memo<Props>(({ datasource, query, onChange }) => {
  async function loadLabelData(query: PromVisualQuery, datasource: PrometheusDatasource): Promise<any> {
    const labels = [{ label: '__name__', op: '=', value: query.metric }, ...query.labels];
    const expr = promQueryModeller.renderLabels(labels);

    const result = await datasource.languageProvider.fetchSeriesLabels(expr);
    setLabelData(result);
  }

  const [labelData, setLabelData] = useState<any>(() => {
    loadLabelData(query, datasource);
  });

  const onChangeLabels = (labels: QueryBuilderLabelFilter[]) => {
    onChange({ ...query, labels });
  };

  const onChangeMetric = async (query: PromVisualQuery) => {
    onChange(query);
    loadLabelData(query, datasource);
  };

  const onGetLabelValues = async (forLabel: Partial<QueryBuilderLabelFilter>) => {
    return (await datasource.metricFindQuery('label_values(' + forLabel.label + ')')).map((x) => x.text);
  };

  const onGetMetrics = async () => {
    return await datasource.languageProvider.fetchLabelValues('__name__').then((res) => {
      return res;
    });
  };

  return (
    <EditorRows>
      <EditorRow>
        <MetricSelect query={query} onChange={onChangeMetric} onGetMetrics={onGetMetrics} />
      </EditorRow>
      <EditorRow>
        <LabelFilters
          labelsFilters={query.labels}
          labelData={labelData}
          onChange={onChangeLabels}
          onGetLabelValues={onGetLabelValues}
        />
      </EditorRow>
      <EditorRow>
        <OperationList<PromVisualQuery>
          queryModeller={promQueryModeller}
          datasource={datasource as DataSourceApi}
          query={query}
          onChange={onChange}
        />
        {query.binaryQueries && query.binaryQueries.length > 0 && (
          <NestedQueryList query={query} datasource={datasource} onChange={onChange} />
        )}
      </EditorRow>
      <EditorRow>
        <QueryPreview query={query} />
      </EditorRow>
    </EditorRows>
  );
});

PromQueryBuilderInner.displayName = 'PromQueryBuilderInner';
