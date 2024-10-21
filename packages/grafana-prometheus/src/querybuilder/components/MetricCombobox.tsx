// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/MetricSelect.tsx
import { useCallback, useState } from 'react';
import * as React from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { InlineField, InlineFieldRow } from '@grafana/ui';
import { Combobox, ComboboxOption } from '@grafana/ui/src/components/Combobox/Combobox';

import { PrometheusDatasource } from '../../datasource';
import { truncateResult } from '../../language_utils';
import { regexifyLabelValuesQueryString } from '../parsingUtils';
import { QueryBuilderLabelFilter } from '../shared/types';
import { PromVisualQuery } from '../types';

import { MetricsModal } from './metrics-modal/MetricsModal';

export interface MetricComboboxProps {
  metricLookupDisabled: boolean;
  query: PromVisualQuery;
  onChange: (query: PromVisualQuery) => void;
  onGetMetrics: () => Promise<SelectableValue[]>;
  datasource: PrometheusDatasource;
  labelsFilters: QueryBuilderLabelFilter[];
  onBlur?: () => void;
  variableEditor?: boolean;
}

export const PROMETHEUS_QUERY_BUILDER_MAX_RESULTS = 1000;

export function MetricCombobox({
  datasource,
  query,
  onChange,
  onGetMetrics,
  labelsFilters,
  metricLookupDisabled,
  onBlur,
  variableEditor,
}: Readonly<MetricComboboxProps>) {
  const [state, setState] = useState<{
    metrics?: SelectableValue[];
    isLoading?: boolean;
    metricsModalOpen?: boolean;
    initialMetrics?: string[];
    resultsTruncated?: boolean;
  }>({});

  const prometheusMetricEncyclopedia = config.featureToggles.prometheusMetricEncyclopedia;

  /**
   * Reformat the query string and label filters to return all valid results for current query editor state
   */
  const formatKeyValueStringsForLabelValuesQuery = (
    query: string,
    labelsFilters?: QueryBuilderLabelFilter[]
  ): string => {
    const queryString = regexifyLabelValuesQueryString(query);

    return formatPrometheusLabelFiltersToString(queryString, labelsFilters);
  };

  /**
   * Gets label_values response from prometheus API for current autocomplete query string and any existing labels filters
   */
  const getMetricLabels = useCallback(
    (query: string) => {
      const results = datasource.metricFindQuery(formatKeyValueStringsForLabelValuesQuery(query, labelsFilters));

      return results.then((results) => {
        const resultsOptions = results.map((result) => {
          return {
            label: result.text,
            value: result.text,
          };
        });

        return resultsOptions;
      });
    },
    [datasource, labelsFilters]
  );

  const onComboboxChange = useCallback(
    (opt: ComboboxOption<string> | null) => {
      onChange({ ...query, metric: opt?.value ?? '' });
    },
    [onChange, query]
  );

  // TODO: not currently debounced
  const loadOptions = useCallback(
    async (input: string): Promise<ComboboxOption[]> => {
      const metrics = input.length ? await getMetricLabels(input) : await onGetMetrics();

      return metrics.map((option) => ({
        label: option.label ?? option.value,
        value: option.value,
      }));
    },
    [getMetricLabels, onGetMetrics]
  );

  const asyncSelect = () => {
    return <Combobox options={loadOptions} value={query.metric} onChange={onComboboxChange} />;
  };

  return (
    <>
      {prometheusMetricEncyclopedia && !datasource.lookupsDisabled && state.metricsModalOpen && (
        <MetricsModal
          datasource={datasource}
          isOpen={state.metricsModalOpen}
          onClose={() => setState({ ...state, metricsModalOpen: false })}
          query={query}
          onChange={onChange}
          initialMetrics={state.initialMetrics ?? []}
        />
      )}
      {/* format the ui for either the query editor or the variable editor */}
      {variableEditor ? (
        <InlineFieldRow>
          <InlineField
            label="Metric"
            labelWidth={20}
            tooltip={<div>Optional: returns a list of label values for the label name in the specified metric.</div>}
          >
            {asyncSelect()}
          </InlineField>
        </InlineFieldRow>
      ) : (
        <EditorFieldGroup>
          <EditorField label="Metric">{asyncSelect()}</EditorField>
        </EditorFieldGroup>
      )}
    </>
  );
}

export const formatPrometheusLabelFiltersToString = (
  queryString: string,
  labelsFilters: QueryBuilderLabelFilter[] | undefined
): string => {
  const filterArray = labelsFilters ? formatPrometheusLabelFilters(labelsFilters) : [];

  return `label_values({__name__=~".*${queryString}"${filterArray ? filterArray.join('') : ''}},__name__)`;
};

export const formatPrometheusLabelFilters = (labelsFilters: QueryBuilderLabelFilter[]): string[] => {
  return labelsFilters.map((label) => {
    return `,${label.label}="${label.value}"`;
  });
};
