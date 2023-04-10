import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import { DataSourceApi, GrafanaTheme2, PanelData, SelectableValue } from '@grafana/data';
import { EditorRow } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Button, Tag, useStyles2 } from '@grafana/ui';

import { PrometheusDatasource } from '../../datasource';
import { getMetadataString } from '../../language_provider';
import promqlGrammar from '../../promql';
import { promQueryModeller } from '../PromQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { OperationExplainedBox } from '../shared/OperationExplainedBox';
import { OperationList } from '../shared/OperationList';
import { OperationListExplained } from '../shared/OperationListExplained';
import { OperationsEditorRow } from '../shared/OperationsEditorRow';
import { QueryBuilderHints } from '../shared/QueryBuilderHints';
import { RawQuery } from '../shared/RawQuery';
import { regexifyLabelValuesQueryString } from '../shared/parsingUtils';
import { QueryBuilderLabelFilter, QueryBuilderOperation } from '../shared/types';
import { PromVisualQuery } from '../types';

import { LabelFilters } from './LabelFilters';
import { MetricEncyclopediaModal } from './MetricEncyclopediaModal';
import { MetricSelect, PROMETHEUS_QUERY_BUILDER_MAX_RESULTS } from './MetricSelect';
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
  const [metricEncyclopediaModalOpen, setMetricEncyclopediaModalOpen] = useState(false);
  const onChangeLabels = (labels: QueryBuilderLabelFilter[]) => {
    onChange({ ...query, labels });
  };

  const styles = useStyles2(getStyles);
  /**
   * Map metric metadata to SelectableValue for Select component and also adds defined template variables to the list.
   */
  const withTemplateVariableOptions = useCallback(
    async (optionsPromise: Promise<SelectableValue[]>): Promise<SelectableValue[]> => {
      const variables = datasource.getVariables();
      const options = await optionsPromise;
      return [
        ...variables.map((value) => ({ label: value, value })),
        ...options.map((option) => ({ label: option.value, value: option.value, title: option.description })),
      ];
    },
    [datasource]
  );

  /**
   * Function kicked off when user interacts with label in label filters.
   * Formats a promQL expression and passes that off to helper functions depending on API support
   * @param forLabel
   */
  const onGetLabelNames = async (forLabel: Partial<QueryBuilderLabelFilter>): Promise<SelectableValue[]> => {
    // If no metric we need to use a different method
    if (!query.metric) {
      // Todo add caching but inside language provider!
      await datasource.languageProvider.fetchLabels();
      return datasource.languageProvider.getLabelKeys().map((k) => ({ value: k }));
    }

    const labelsToConsider = query.labels.filter((x) => x !== forLabel);
    labelsToConsider.push({ label: '__name__', op: '=', value: query.metric });
    const expr = promQueryModeller.renderLabels(labelsToConsider);

    let labelsIndex;
    if (datasource.hasLabelsMatchAPISupport()) {
      labelsIndex = await datasource.languageProvider.fetchSeriesLabelsMatch(expr);
    } else {
      labelsIndex = await datasource.languageProvider.fetchSeriesLabels(expr);
    }

    // filter out already used labels
    return Object.keys(labelsIndex)
      .filter((labelName) => !labelsToConsider.find((filter) => filter.label === labelName))
      .map((k) => ({ value: k }));
  };

  const getLabelValuesAutocompleteSuggestions = (
    queryString?: string,
    labelName?: string
  ): Promise<SelectableValue[]> => {
    const forLabel = {
      label: labelName ?? '__name__',
      op: '=~',
      value: regexifyLabelValuesQueryString(`.*${queryString}`),
    };
    const labelsToConsider = query.labels.filter((x) => x.label !== forLabel.label);
    labelsToConsider.push(forLabel);
    if (query.metric) {
      labelsToConsider.push({ label: '__name__', op: '=', value: query.metric });
    }
    const interpolatedLabelsToConsider = labelsToConsider.map((labelObject) => ({
      ...labelObject,
      label: datasource.interpolateString(labelObject.label),
      value: datasource.interpolateString(labelObject.value),
    }));
    const expr = promQueryModeller.renderLabels(interpolatedLabelsToConsider);
    let response;
    if (datasource.hasLabelsMatchAPISupport()) {
      response = getLabelValuesFromLabelValuesAPI(forLabel, expr);
    } else {
      response = getLabelValuesFromSeriesAPI(forLabel, expr);
    }

    return response.then((response: SelectableValue[]) => {
      if (response.length > PROMETHEUS_QUERY_BUILDER_MAX_RESULTS) {
        response.splice(0, response.length - PROMETHEUS_QUERY_BUILDER_MAX_RESULTS);
      }
      return response;
    });
  };

  /**
   * Helper function to fetch and format label value results from legacy API
   * @param forLabel
   * @param promQLExpression
   */
  const getLabelValuesFromSeriesAPI = (
    forLabel: Partial<QueryBuilderLabelFilter>,
    promQLExpression: string
  ): Promise<SelectableValue[]> => {
    if (!forLabel.label) {
      return Promise.resolve([]);
    }
    const result = datasource.languageProvider.fetchSeries(promQLExpression);
    const forLabelInterpolated = datasource.interpolateString(forLabel.label);
    return result.then((result) => {
      // This query returns duplicate values, scrub them out
      const set = new Set<string>();
      result.forEach((labelValue) => {
        const labelNameString = labelValue[forLabelInterpolated];
        set.add(labelNameString);
      });

      return Array.from(set).map((labelValues: string) => ({ label: labelValues, value: labelValues }));
    });
  };

  /**
   * Helper function to fetch label values from a promql string expression and a label
   * @param forLabel
   * @param promQLExpression
   */
  const getLabelValuesFromLabelValuesAPI = (
    forLabel: Partial<QueryBuilderLabelFilter>,
    promQLExpression: string
  ): Promise<SelectableValue[]> => {
    if (!forLabel.label) {
      return Promise.resolve([]);
    }
    return datasource.languageProvider.fetchSeriesValuesWithMatch(forLabel.label, promQLExpression).then((response) => {
      return response.map((v) => ({
        value: v,
        label: v,
      }));
    });
  };

  /**
   * Function kicked off when users interact with the value of the label filters
   * Formats a promQL expression and passes that into helper functions depending on API support
   * @param forLabel
   */
  const onGetLabelValues = async (forLabel: Partial<QueryBuilderLabelFilter>): Promise<SelectableValue[]> => {
    if (!forLabel.label) {
      return [];
    }
    // If no metric is selected, we can get the raw list of labels
    if (!query.metric) {
      return (await datasource.languageProvider.getLabelValues(forLabel.label)).map((v) => ({ value: v }));
    }

    const labelsToConsider = query.labels.filter((x) => x !== forLabel);
    labelsToConsider.push({ label: '__name__', op: '=', value: query.metric });

    const interpolatedLabelsToConsider = labelsToConsider.map((labelObject) => ({
      ...labelObject,
      label: datasource.interpolateString(labelObject.label),
      value: datasource.interpolateString(labelObject.value),
    }));

    const expr = promQueryModeller.renderLabels(interpolatedLabelsToConsider);

    if (datasource.hasLabelsMatchAPISupport()) {
      return getLabelValuesFromLabelValuesAPI(forLabel, expr);
    } else {
      return getLabelValuesFromSeriesAPI(forLabel, expr);
    }
  };

  const onGetMetrics = useCallback(() => {
    return withTemplateVariableOptions(getMetrics(datasource, query));
  }, [datasource, query, withTemplateVariableOptions]);

  const lang = { grammar: promqlGrammar, name: 'promql' };
  const MetricEncyclopedia = config.featureToggles.prometheusMetricEncyclopedia;

  return (
    <>
      <EditorRow>
        {MetricEncyclopedia ? (
          <>
            <Button
              className={styles.button}
              variant="secondary"
              size="sm"
              onClick={() => setMetricEncyclopediaModalOpen((prevValue) => !prevValue)}
            >
              Metric encyclopedia
            </Button>
            {query.metric && (
              <Tag
                name={' ' + query.metric}
                color="#3D71D9"
                icon="times"
                onClick={() => {
                  onChange({ ...query, metric: '' });
                }}
                title="Click to remove metric"
                className={styles.metricTag}
              />
            )}
            {metricEncyclopediaModalOpen && (
              <MetricEncyclopediaModal
                datasource={datasource}
                isOpen={metricEncyclopediaModalOpen}
                onClose={() => setMetricEncyclopediaModalOpen(false)}
                query={query}
                onChange={onChange}
              />
            )}
          </>
        ) : (
          <MetricSelect
            query={query}
            onChange={onChange}
            onGetMetrics={onGetMetrics}
            datasource={datasource}
            labelsFilters={query.labels}
          />
        )}
        <LabelFilters
          debounceDuration={datasource.getDebounceTimeInMilliseconds()}
          getLabelValuesAutofillSuggestions={getLabelValuesAutocompleteSuggestions}
          labelsFilters={query.labels}
          // eslint-ignore
          onChange={onChangeLabels as (labelFilters: Array<Partial<QueryBuilderLabelFilter>>) => void}
          onGetLabelNames={(forLabel) => withTemplateVariableOptions(onGetLabelNames(forLabel))}
          onGetLabelValues={(forLabel) => withTemplateVariableOptions(onGetLabelValues(forLabel))}
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
          // eslint-ignore
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    button: css`
      height: auto;
    `,
    metricTag: css`
      margin: '10px 0 10px 0',
      backgroundColor: '#3D71D9',
    `,
  };
};
