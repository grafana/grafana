import { useCallback } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup } from '@grafana/experimental';
import { InlineField, InlineFieldRow, Combobox, ComboboxOption } from '@grafana/ui';

import { PrometheusDatasource } from '../../datasource';
import { regexifyLabelValuesQueryString } from '../parsingUtils';
import { QueryBuilderLabelFilter } from '../shared/types';
import { PromVisualQuery } from '../types';

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

export function MetricCombobox({
  datasource,
  query,
  onChange,
  onGetMetrics,
  labelsFilters,
  variableEditor,
}: Readonly<MetricComboboxProps>) {
  /**
   * Gets label_values response from prometheus API for current autocomplete query string and any existing labels filters
   */
  const getMetricLabels = useCallback(
    async (query: string) => {
      const results = await datasource.metricFindQuery(formatKeyValueStringsForLabelValuesQuery(query, labelsFilters));

      const resultsOptions = results.map((result) => {
        return {
          label: result.text,
          value: result.text,
        };
      });
      return resultsOptions;
    },
    [datasource, labelsFilters]
  );

  const onComboboxChange = useCallback(
    (opt: ComboboxOption<string> | null) => {
      onChange({ ...query, metric: opt?.value ?? '' });
    },
    [onChange, query]
  );

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
    return (
      <Combobox
        placeholder="Select metric"
        width="auto"
        minWidth={25}
        options={loadOptions}
        value={query.metric}
        onChange={onComboboxChange}
      />
    );
  };

  return (
    <>
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

/**
 * Reformat the query string and label filters to return all valid results for current query editor state
 */
const formatKeyValueStringsForLabelValuesQuery = (query: string, labelsFilters?: QueryBuilderLabelFilter[]): string => {
  const queryString = regexifyLabelValuesQueryString(query);

  return formatPrometheusLabelFiltersToString(queryString, labelsFilters);
};
