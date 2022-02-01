import React from 'react';
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
import { OperationsEditorRow } from '../shared/OperationsEditorRow';

export interface Props {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromVisualQuery) => void;
  onRunQuery: () => void;
  nested?: boolean;
}

export const PromQueryBuilder = React.memo<Props>(({ datasource, query, onChange, onRunQuery, nested }) => {
  const onChangeLabels = (labels: QueryBuilderLabelFilter[]) => {
    onChange({ ...query, labels });
  };

  const onGetLabelNames = async (forLabel: Partial<QueryBuilderLabelFilter>): Promise<string[]> => {
    // If no metric we need to use a different method
    if (!query.metric) {
      // Todo add caching but inside language provider!
      await datasource.languageProvider.fetchLabels();
      return datasource.languageProvider.getLabelKeys();
    }

    const labelsToConsider = query.labels.filter((x) => x !== forLabel);
    labelsToConsider.push({ label: '__name__', op: '=', value: query.metric });
    const expr = promQueryModeller.renderLabels(labelsToConsider);
    const labelsIndex = await datasource.languageProvider.fetchSeriesLabels(expr);

    // filter out already used labels
    return Object.keys(labelsIndex).filter(
      (labelName) => !labelsToConsider.find((filter) => filter.label === labelName)
    );
  };

  const onGetLabelValues = async (forLabel: Partial<QueryBuilderLabelFilter>) => {
    if (!forLabel.label) {
      return [];
    }

    // If no metric we need to use a different method
    if (!query.metric) {
      return await datasource.languageProvider.getLabelValues(forLabel.label);
    }

    const labelsToConsider = query.labels.filter((x) => x !== forLabel);
    labelsToConsider.push({ label: '__name__', op: '=', value: query.metric });
    const expr = promQueryModeller.renderLabels(labelsToConsider);
    const result = await datasource.languageProvider.fetchSeriesLabels(expr);
    return result[forLabel.label] ?? [];
  };

  const onGetMetrics = async () => {
    if (query.labels.length > 0) {
      const expr = promQueryModeller.renderLabels(query.labels);
      return (await datasource.languageProvider.getSeries(expr, true))['__name__'] ?? [];
    } else {
      return (await datasource.languageProvider.getLabelValues('__name__')) ?? [];
    }
  };

  return (
    <EditorRows>
      <EditorRow>
        <MetricSelect query={query} onChange={onChange} onGetMetrics={onGetMetrics} />
        <LabelFilters
          labelsFilters={query.labels}
          onChange={onChangeLabels}
          onGetLabelNames={onGetLabelNames}
          onGetLabelValues={onGetLabelValues}
        />
      </EditorRow>
      <OperationsEditorRow>
        <OperationList<PromVisualQuery>
          queryModeller={promQueryModeller}
          datasource={datasource as DataSourceApi}
          query={query}
          onChange={onChange}
          onRunQuery={onRunQuery}
        />
        {query.binaryQueries && query.binaryQueries.length > 0 && (
          <NestedQueryList query={query} datasource={datasource} onChange={onChange} onRunQuery={onRunQuery} />
        )}
      </OperationsEditorRow>
      {!nested && (
        <EditorRow>
          <QueryPreview query={query} />
        </EditorRow>
      )}
    </EditorRows>
  );
});

PromQueryBuilder.displayName = 'PromQueryBuilder';
