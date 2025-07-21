// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/MetricsLabelsSection.tsx
import { useCallback } from 'react';

import { SelectableValue, TimeRange } from '@grafana/data';

import { getDebounceTimeInMilliseconds } from '../../caching';
import { PrometheusDatasource } from '../../datasource';
import { truncateResult } from '../../language_utils';
import { PromMetricsMetadata } from '../../types';
import { regexifyLabelValuesQueryString } from '../parsingUtils';
import { promQueryModeller } from '../shared/modeller_instance';
import { QueryBuilderLabelFilter } from '../shared/types';
import { PromVisualQuery } from '../types';

import { LabelFilters } from './LabelFilters';
import { MetricCombobox } from './MetricCombobox';

interface MetricsLabelsSectionProps {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromVisualQuery) => void;
  variableEditor?: boolean;
  onBlur?: () => void;
  timeRange: TimeRange;
}

export function MetricsLabelsSection({
  datasource,
  query,
  onChange,
  onBlur,
  variableEditor,
  timeRange,
}: MetricsLabelsSectionProps) {
  // fixing the use of 'as' from refactoring
  // @ts-ignore
  const onChangeLabels = (labels) => {
    onChange({ ...query, labels });
  };
  /**
   * Map metric metadata to SelectableValue for Select component and also adds defined template variables to the list.
   */
  const withTemplateVariableOptions = useCallback(
    async (optionsPromise: Promise<SelectableValue[]>): Promise<SelectableValue[]> => {
      const variables = datasource.getVariables();
      const options = await optionsPromise;
      return [
        ...variables.map((value: string) => ({ label: value, value })),
        ...options.map((option: SelectableValue) => ({
          label: option.value,
          value: option.value,
          title: option.description,
        })),
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
      await datasource.languageProvider.queryLabelKeys(timeRange);
      return datasource.languageProvider.retrieveLabelKeys().map((k) => ({ value: k }));
    }

    const labelsToConsider = query.labels.filter((x) => x !== forLabel);
    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
    labelsToConsider.push({ label: '__name__', op: '=', value: query.metric });
    const expr = promQueryModeller.renderLabels(labelsToConsider);

    let labelsIndex: string[] = await datasource.languageProvider.queryLabelKeys(timeRange, expr);

    // filter out already used labels
    return labelsIndex
      .filter((labelName) => !labelsToConsider.find((filter) => filter.label === labelName))
      .map((k) => ({ value: k }));
  };

  const getLabelValuesAutocompleteSuggestions = async (
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
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      labelsToConsider.push({ label: '__name__', op: '=', value: query.metric });
    }
    const interpolatedLabelsToConsider = labelsToConsider.map((labelObject) => ({
      ...labelObject,
      label: datasource.interpolateString(labelObject.label),
      value: datasource.interpolateString(labelObject.value),
    }));
    const expr = promQueryModeller.renderLabels(interpolatedLabelsToConsider);
    const values = await datasource.languageProvider.queryLabelValues(timeRange, forLabel.label, expr);
    return truncateResult(values).map(toSelectableValue);
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
      return (await datasource.languageProvider.queryLabelValues(timeRange, forLabel.label)).map((v) => ({ value: v }));
    }

    const labelsToConsider = query.labels.filter((x) => x !== forLabel);
    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
    labelsToConsider.push({ label: '__name__', op: '=', value: query.metric });

    const interpolatedLabelsToConsider = labelsToConsider.map((labelObject) => ({
      ...labelObject,
      label: datasource.interpolateString(labelObject.label),
      value: datasource.interpolateString(labelObject.value),
    }));

    const expr = promQueryModeller.renderLabels(interpolatedLabelsToConsider);
    return (await datasource.languageProvider.queryLabelValues(timeRange, forLabel.label, expr)).map(toSelectableValue);
  };

  const onGetMetrics = useCallback(() => {
    return withTemplateVariableOptions(getMetrics(datasource, query, timeRange));
  }, [datasource, query, timeRange, withTemplateVariableOptions]);

  return (
    <>
      <MetricCombobox
        query={query}
        onChange={onChange}
        onGetMetrics={onGetMetrics}
        datasource={datasource}
        labelsFilters={query.labels}
        metricLookupDisabled={datasource.lookupsDisabled}
        onBlur={onBlur ? onBlur : () => {}}
        variableEditor={variableEditor}
        timeRange={timeRange}
      />
      <LabelFilters
        debounceDuration={getDebounceTimeInMilliseconds(datasource.cacheLevel)}
        getLabelValuesAutofillSuggestions={getLabelValuesAutocompleteSuggestions}
        labelsFilters={query.labels}
        onChange={onChangeLabels}
        onGetLabelNames={(forLabel) => withTemplateVariableOptions(onGetLabelNames(forLabel))}
        onGetLabelValues={(forLabel) => withTemplateVariableOptions(onGetLabelValues(forLabel))}
        variableEditor={variableEditor}
      />
    </>
  );
}

/**
 * Returns list of metrics, either all or filtered by query param. It also adds description string to each metric if it
 * exists.
 * @param datasource
 * @param query
 * @param timeRange
 */
async function getMetrics(
  datasource: PrometheusDatasource,
  query: PromVisualQuery,
  timeRange: TimeRange
): Promise<Array<{ value: string; description?: string }>> {
  // Makes sure we loaded the metadata for metrics. Usually this is done in the start() method of the provider but we
  // don't use it with the visual builder and there is no need to run all the start() setup anyway.
  const metadata = datasource.languageProvider.retrieveMetricsMetadata();
  if (Object.keys(metadata).length === 0) {
    await datasource.languageProvider.queryMetricsMetadata();
  }

  let metrics: string[];
  const expr = promQueryModeller.renderLabels(query.labels);
  metrics =
    (await datasource.languageProvider.queryLabelValues(timeRange, '__name__', expr === '' ? undefined : expr)) ?? [];

  return metrics.map((m) => ({
    value: m,
    description: getMetadataString(m, datasource.languageProvider.retrieveMetricsMetadata()),
  }));
}

function getMetadataString(metric: string, metadata: PromMetricsMetadata): string | undefined {
  if (!metadata[metric]) {
    return;
  }
  const { type, help } = metadata[metric];
  return `${type.toUpperCase()}: ${help}`;
}

function toSelectableValue(lv: string) {
  return {
    label: lv,
    value: lv,
  };
}
