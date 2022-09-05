import React, { useCallback, useState } from 'react';

import { DataSourceApi, PanelData, SelectableValue } from '@grafana/data';
import { EditorRow } from '@grafana/ui';

import { PrometheusDatasource } from '../../datasource';
import { getMetadataString } from '../../language_provider';
import promqlGrammar from '../../promql';
import { promQueryModeller } from '../PromQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { LabelFilters } from '../shared/LabelFilters';
import { OperationExplainedBox } from '../shared/OperationExplainedBox';
import { OperationList } from '../shared/OperationList';
import { OperationListExplained } from '../shared/OperationListExplained';
import { OperationsEditorRow } from '../shared/OperationsEditorRow';
import { QueryBuilderHints } from '../shared/QueryBuilderHints';
import { RawQuery } from '../shared/RawQuery';
import { QueryBuilderLabelFilter, QueryBuilderOperation } from '../shared/types';
import { PromVisualQuery } from '../types';

import { MetricSelect } from './MetricSelect';
import { NestedQueryList } from './NestedQueryList';
import { EXPLAIN_LABEL_FILTER_CONTENT } from './PromQueryBuilderExplained';

export interface Props {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromVisualQuery) => void;
  onRunQuery: () => void;
  data?: PanelData;
  showExplain: boolean;
}

export const PromQueryBuilder = React.memo<Props>((props) => {
  const { datasource, query, onChange, onRunQuery, data, showExplain } = props;
  const [highlightedOp, setHighlightedOp] = useState<QueryBuilderOperation | undefined>();
  const onChangeLabels = (labels: QueryBuilderLabelFilter[]) => {
    onChange({ ...query, labels });
  };

  /**
   * Map metric metadata to SelectableValue for Select component and also adds defined template variables to the list.
   */
  const withTemplateVariableOptions = useCallback(
    async (optionsPromise: Promise<Array<{ value: string; description?: string }>>): Promise<SelectableValue[]> => {
      const variables = datasource.getVariables();
      const options = await optionsPromise;
      return [
        ...variables.map((value) => ({ label: value, value })),
        ...options.map((option) => ({ label: option.value, value: option.value, title: option.description })),
      ];
    },
    [datasource]
  );

  const onGetLabelNames = async (forLabel: Partial<QueryBuilderLabelFilter>): Promise<Array<{ value: string }>> => {
    // If no metric we need to use a different method
    if (!query.metric) {
      // Todo add caching but inside language provider!
      await datasource.languageProvider.fetchLabels();
      return datasource.languageProvider.getLabelKeys().map((k) => ({ value: k }));
    }

    const labelsToConsider = query.labels.filter((x) => x !== forLabel);
    labelsToConsider.push({ label: '__name__', op: '=', value: query.metric });
    const expr = promQueryModeller.renderLabels(labelsToConsider);
    const labelsIndex = await datasource.languageProvider.fetchSeriesLabels(expr);

    // filter out already used labels
    return Object.keys(labelsIndex)
      .filter((labelName) => !labelsToConsider.find((filter) => filter.label === labelName))
      .map((k) => ({ value: k }));
  };

  const onGetLabelValues = async (forLabel: Partial<QueryBuilderLabelFilter>) => {
    if (!forLabel.label) {
      return [];
    }

    // If no metric we need to use a different method
    if (!query.metric) {
      return (await datasource.languageProvider.getLabelValues(forLabel.label)).map((v) => ({ value: v }));
    }

    const labelsToConsider = query.labels.filter((x) => x !== forLabel);
    labelsToConsider.push({ label: '__name__', op: '=', value: query.metric });
    const expr = promQueryModeller.renderLabels(labelsToConsider);
    const result = await datasource.languageProvider.fetchSeriesLabels(expr);
    const forLabelInterpolated = datasource.interpolateString(forLabel.label);
    return result[forLabelInterpolated].map((v) => ({ value: v })) ?? [];
  };

  const onGetMetrics = useCallback(() => {
    return withTemplateVariableOptions(getMetrics(datasource, query));
  }, [datasource, query, withTemplateVariableOptions]);

  const lang = { grammar: promqlGrammar, name: 'promql' };

  return (
    <>
      <EditorRow>
        <MetricSelect query={query} onChange={onChange} onGetMetrics={onGetMetrics} />
        <LabelFilters
          labelsFilters={query.labels}
          onChange={onChangeLabels}
          onGetLabelNames={(forLabel: Partial<QueryBuilderLabelFilter>) =>
            withTemplateVariableOptions(onGetLabelNames(forLabel))
          }
          onGetLabelValues={(forLabel: Partial<QueryBuilderLabelFilter>) =>
            withTemplateVariableOptions(onGetLabelValues(forLabel))
          }
        />
      </EditorRow>
      {showExplain && (
        <OperationExplainedBox
          stepNumber={1}
          title={<RawQuery query={`${query.metric} ${promQueryModeller.renderLabels(query.labels)}`} lang={lang} />}
        >
          {EXPLAIN_LABEL_FILTER_CONTENT}
        </OperationExplainedBox>
      )}
      <OperationsEditorRow>
        <OperationList<PromVisualQuery>
          queryModeller={promQueryModeller}
          datasource={datasource as DataSourceApi}
          query={query}
          onChange={onChange}
          onRunQuery={onRunQuery}
          highlightedOp={highlightedOp}
        />
        <QueryBuilderHints<PromVisualQuery>
          datasource={datasource}
          query={query}
          onChange={onChange}
          data={data}
          queryModeller={promQueryModeller}
          buildVisualQueryFromString={buildVisualQueryFromString}
        />
      </OperationsEditorRow>
      {showExplain && (
        <OperationListExplained<PromVisualQuery>
          lang={lang}
          query={query}
          stepNumber={2}
          queryModeller={promQueryModeller}
          onMouseEnter={(op) => setHighlightedOp(op)}
          onMouseLeave={() => setHighlightedOp(undefined)}
        />
      )}
      {query.binaryQueries && query.binaryQueries.length > 0 && (
        <NestedQueryList
          query={query}
          datasource={datasource}
          onChange={onChange}
          onRunQuery={onRunQuery}
          showExplain={showExplain}
        />
      )}
    </>
  );
});

/**
 * Returns list of metrics, either all or filtered by query param. It also adds description string to each metric if it
 * exists.
 * @param datasource
 * @param query
 */
async function getMetrics(
  datasource: PrometheusDatasource,
  query: PromVisualQuery
): Promise<Array<{ value: string; description?: string }>> {
  // Makes sure we loaded the metadata for metrics. Usually this is done in the start() method of the provider but we
  // don't use it with the visual builder and there is no need to run all the start() setup anyway.
  if (!datasource.languageProvider.metricsMetadata) {
    await datasource.languageProvider.loadMetricsMetadata();
  }

  // Error handling for when metrics metadata returns as undefined
  if (!datasource.languageProvider.metricsMetadata) {
    datasource.languageProvider.metricsMetadata = {};
  }

  let metrics;
  if (query.labels.length > 0) {
    const expr = promQueryModeller.renderLabels(query.labels);
    metrics = (await datasource.languageProvider.getSeries(expr, true))['__name__'] ?? [];
  } else {
    metrics = (await datasource.languageProvider.getLabelValues('__name__')) ?? [];
  }

  return metrics.map((m) => ({
    value: m,
    description: getMetadataString(m, datasource.languageProvider.metricsMetadata!),
  }));
}

PromQueryBuilder.displayName = 'PromQueryBuilder';
