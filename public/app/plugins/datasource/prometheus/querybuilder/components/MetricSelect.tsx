import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import React, { useCallback, useState } from 'react';
import Highlighter from 'react-highlight-words';

import { SelectableValue, toOption, GrafanaTheme2 } from '@grafana/data';
import { EditorField, EditorFieldGroup } from '@grafana/experimental';
import { AsyncSelect, FormatOptionLabelMeta, useStyles2 } from '@grafana/ui';

import { PrometheusDatasource } from '../../datasource';
import { regexifyLabelValuesQueryString } from '../shared/parsingUtils';
import { QueryBuilderLabelFilter } from '../shared/types';
import { PromVisualQuery } from '../types';

// We are matching words split with space
const splitSeparator = ' ';

export interface Props {
  query: PromVisualQuery;
  onChange: (query: PromVisualQuery) => void;
  onGetMetrics: () => Promise<SelectableValue[]>;
  datasource: PrometheusDatasource;
  labelsFilters: QueryBuilderLabelFilter[];
}

export const PROMETHEUS_QUERY_BUILDER_MAX_RESULTS = 1000;

export function MetricSelect({ datasource, query, onChange, onGetMetrics, labelsFilters }: Props) {
  const styles = useStyles2(getStyles);
  const [state, setState] = useState<{
    metrics?: Array<SelectableValue<any>>;
    isLoading?: boolean;
  }>({});

  const customFilterOption = useCallback((option: SelectableValue<any>, searchQuery: string) => {
    const label = option.label ?? option.value;
    if (!label) {
      return false;
    }

    // custom value is not a string label but a react node
    if (!label.toLowerCase) {
      return true;
    }

    const searchWords = searchQuery.split(splitSeparator);
    return searchWords.reduce((acc, cur) => acc && label.toLowerCase().includes(cur.toLowerCase()), true);
  }, []);

  const formatOptionLabel = useCallback(
    (option: SelectableValue<any>, meta: FormatOptionLabelMeta<any>) => {
      // For newly created custom value we don't want to add highlight
      if (option['__isNew__']) {
        return option.label;
      }

      return (
        <Highlighter
          searchWords={meta.inputValue.split(splitSeparator)}
          textToHighlight={option.label ?? ''}
          highlightClassName={styles.highlight}
        />
      );
    },
    [styles.highlight]
  );

  const formatLabelFilters = (labelsFilters: QueryBuilderLabelFilter[]): string[] => {
    return labelsFilters.map((label) => {
      return `,${label.label}="${label.value}"`;
    });
  };

  /**
   * Transform queryString and any currently set label filters into label_values() string
   */
  const queryAndFilterToLabelValuesString = (
    queryString: string,
    labelsFilters: QueryBuilderLabelFilter[] | undefined
  ): string => {
    return `label_values({__name__=~".*${queryString}"${
      labelsFilters ? formatLabelFilters(labelsFilters).join() : ''
    }},__name__)`;
  };

  /**
   * Reformat the query string and label filters to return all valid results for current query editor state
   */
  const formatKeyValueStringsForLabelValuesQuery = (
    query: string,
    labelsFilters?: QueryBuilderLabelFilter[]
  ): string => {
    const queryString = regexifyLabelValuesQueryString(query);

    return queryAndFilterToLabelValuesString(queryString, labelsFilters);
  };

  /**
   * Gets label_values response from prometheus API for current autocomplete query string and any existing labels filters
   */
  const getMetricLabels = (query: string) => {
    // Since some customers can have millions of metrics, whenever the user changes the autocomplete text we want to call the backend and request all metrics that match the current query string
    const results = datasource.metricFindQuery(formatKeyValueStringsForLabelValuesQuery(query, labelsFilters));
    return results.then((results) => {
      if (results.length > PROMETHEUS_QUERY_BUILDER_MAX_RESULTS) {
        results.splice(0, results.length - PROMETHEUS_QUERY_BUILDER_MAX_RESULTS);
      }
      return results.map((result) => {
        return {
          label: result.text,
          value: result.text,
        };
      });
    });
  };

  const debouncedSearch = debounce(
    (query: string) => getMetricLabels(query),
    datasource.getDebounceTimeInMilliseconds()
  );

  return (
    <EditorFieldGroup>
      <EditorField label="Metric">
        <AsyncSelect
          inputId="prometheus-metric-select"
          className={styles.select}
          value={query.metric ? toOption(query.metric) : undefined}
          placeholder="Select metric"
          allowCustomValue
          formatOptionLabel={formatOptionLabel}
          filterOption={customFilterOption}
          onOpenMenu={async () => {
            setState({ isLoading: true });
            const metrics = await onGetMetrics();
            if (metrics.length > PROMETHEUS_QUERY_BUILDER_MAX_RESULTS) {
              metrics.splice(0, metrics.length - PROMETHEUS_QUERY_BUILDER_MAX_RESULTS);
            }
            setState({ metrics, isLoading: undefined });
          }}
          loadOptions={debouncedSearch}
          isLoading={state.isLoading}
          defaultOptions={state.metrics}
          onChange={({ value }) => {
            if (value) {
              onChange({ ...query, metric: value });
            }
          }}
        />
      </EditorField>
    </EditorFieldGroup>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  select: css`
    min-width: 125px;
  `,
  highlight: css`
    label: select__match-highlight;
    background: inherit;
    padding: inherit;
    color: ${theme.colors.warning.contrastText};
    background-color: ${theme.colors.warning.main};
  `,
});
