import { AnyAction } from '@reduxjs/toolkit';

import { reportInteraction } from '@grafana/runtime';
import { PrometheusDatasource } from 'app/plugins/datasource/prometheus/datasource';
import { getMetadataHelp, getMetadataType } from 'app/plugins/datasource/prometheus/language_provider';

import { regexifyLabelValuesQueryString } from '../../../shared/parsingUtils';
import { QueryBuilderLabelFilter } from '../../../shared/types';
import { PromVisualQuery } from '../../../types';
import { HaystackDictionary, MetricData, MetricsData, PromFilterOption } from '../types';

import { MetricsModalMetadata, MetricsModalState, stateSlice } from './state';

const { setFilteredMetricCount } = stateSlice.actions;

export async function setMetrics(
  datasource: PrometheusDatasource,
  query: PromVisualQuery,
  initialMetrics?: string[]
): Promise<MetricsModalMetadata> {
  // metadata is set in the metric select now
  // use this to disable metadata search and display
  let hasMetadata = true;
  const metadata = datasource.languageProvider.metricsMetadata;
  if (metadata && Object.keys(metadata).length === 0) {
    hasMetadata = false;
  }

  let nameHaystackDictionaryData: HaystackDictionary = {};
  let metaHaystackDictionaryData: HaystackDictionary = {};

  // pass in metrics from getMetrics in the query builder, reduced in the metric select
  let metricsData: MetricsData | undefined;

  metricsData = initialMetrics?.map((m: string) => {
    const metricData = buildMetricData(m, datasource);

    const metaDataString = `${m}¦${metricData.description}`;

    nameHaystackDictionaryData[m] = metricData;
    metaHaystackDictionaryData[metaDataString] = metricData;

    return metricData;
  });

  return {
    isLoading: false,
    hasMetadata: hasMetadata,
    metrics: metricsData ?? [],
    metaHaystackDictionary: metaHaystackDictionaryData,
    nameHaystackDictionary: nameHaystackDictionaryData,
    totalMetricCount: metricsData?.length ?? 0,
    filteredMetricCount: metricsData?.length ?? 0,
  };
}

/**
 * Builds the metric data object with type and description
 *
 * @param   metric  The metric name
 * @param   datasource  The Prometheus datasource for mapping metradata to the metric name
 * @returns A MetricData object.
 */
function buildMetricData(metric: string, datasource: PrometheusDatasource): MetricData {
  let type = getMetadataType(metric, datasource.languageProvider.metricsMetadata!);

  const description = getMetadataHelp(metric, datasource.languageProvider.metricsMetadata!);

  ['histogram', 'summary'].forEach((t) => {
    if (description?.toLowerCase().includes(t) && type !== t) {
      type += ` (${t})`;
    }
  });

  const metricData: MetricData = {
    value: metric,
    type: type,
    description: description,
  };

  return metricData;
}

/**
 * The filtered and paginated metrics displayed in the modal
 * */
export function displayedMetrics(state: MetricsModalState, dispatch: React.Dispatch<AnyAction>) {
  const filteredSorted: MetricsData = filterMetrics(state);

  if (!state.isLoading && state.filteredMetricCount !== filteredSorted.length) {
    dispatch(setFilteredMetricCount(filteredSorted.length));
  }

  return sliceMetrics(filteredSorted, state.pageNum, state.resultsPerPage);
}

/**
 * Filter the metrics with all the options, fuzzy, type, null metadata
 */
export function filterMetrics(state: MetricsModalState): MetricsData {
  let filteredMetrics: MetricsData = state.metrics;

  if (state.fuzzySearchQuery && !state.useBackend) {
    if (state.fullMetaSearch) {
      filteredMetrics = state.metaHaystackOrder.map((needle: string) => state.metaHaystackDictionary[needle]);
    } else {
      filteredMetrics = state.nameHaystackOrder.map((needle: string) => state.nameHaystackDictionary[needle]);
    }
  }

  if (state.selectedTypes.length > 0) {
    filteredMetrics = filteredMetrics.filter((m: MetricData, idx) => {
      // Matches type
      const matchesSelectedType = state.selectedTypes.some((t) => {
        if (m.type && t.value) {
          return m.type.includes(t.value);
        }

        if (!m.type && t.value === 'no type') {
          return true;
        }

        return false;
      });

      // when a user filters for type, only return metrics with defined types
      return matchesSelectedType;
    });
  }

  if (!state.includeNullMetadata) {
    filteredMetrics = filteredMetrics.filter((m: MetricData) => {
      return m.type !== undefined && m.description !== undefined;
    });
  }

  return filteredMetrics;
}

export function calculatePageList(state: MetricsModalState) {
  if (!state.metrics.length) {
    return [];
  }

  const calcResultsPerPage: number = state.resultsPerPage === 0 ? 1 : state.resultsPerPage;

  const pages = Math.floor(filterMetrics(state).length / calcResultsPerPage) + 1;

  return [...Array(pages).keys()].map((i) => i + 1);
}

export function sliceMetrics(metrics: MetricsData, pageNum: number, resultsPerPage: number) {
  const calcResultsPerPage: number = resultsPerPage === 0 ? 1 : resultsPerPage;
  const start: number = pageNum === 1 ? 0 : (pageNum - 1) * calcResultsPerPage;
  const end: number = start + calcResultsPerPage;
  return metrics.slice(start, end);
}

export const calculateResultsPerPage = (results: number, defaultResults: number, max: number) => {
  if (results < 1) {
    return 1;
  }

  if (results > max) {
    return max;
  }

  return results ?? defaultResults;
};

/**
 * The backend query that replaces the uFuzzy search when the option 'useBackend' has been selected
 * this is a regex search either to the series or labels Prometheus endpoint
 * depending on which the Prometheus type or version supports
 * @param metricText
 * @param labels
 * @param datasource
 */
export async function getBackendSearchMetrics(
  metricText: string,
  labels: QueryBuilderLabelFilter[],
  datasource: PrometheusDatasource
): Promise<Array<{ value: string }>> {
  const queryString = regexifyLabelValuesQueryString(metricText);

  const labelsParams = labels.map((label) => {
    return `,${label.label}="${label.value}"`;
  });

  const params = `label_values({__name__=~".*${queryString}"${labels ? labelsParams.join() : ''}},__name__)`;

  const results = datasource.metricFindQuery(params);

  return await results.then((results) => {
    return results.map((result) => buildMetricData(result.text, datasource));
  });
}

export function tracking(event: string, state?: MetricsModalState | null, metric?: string, query?: PromVisualQuery) {
  switch (event) {
    case 'grafana_prom_metric_encycopedia_tracking':
      reportInteraction(event, {
        metric: metric,
        hasMetadata: state?.hasMetadata,
        totalMetricCount: state?.totalMetricCount,
        fuzzySearchQuery: state?.fuzzySearchQuery,
        fullMetaSearch: state?.fullMetaSearch,
        selectedTypes: state?.selectedTypes,
      });
    case 'grafana_prom_metric_encycopedia_disable_text_wrap_interaction':
      reportInteraction(event, {
        disableTextWrap: state?.disableTextWrap,
      });
    case 'grafana_prometheus_metric_encyclopedia_open':
      reportInteraction(event, {
        query: query,
      });
  }
}

export const promTypes: PromFilterOption[] = [
  {
    value: 'counter',
    description:
      'A cumulative metric that represents a single monotonically increasing counter whose value can only increase or be reset to zero on restart.',
  },
  {
    value: 'gauge',
    description: 'A metric that represents a single numerical value that can arbitrarily go up and down.',
  },
  {
    value: 'histogram',
    description:
      'A histogram samples observations (usually things like request durations or response sizes) and counts them in configurable buckets.',
  },
  {
    value: 'summary',
    description:
      'A summary samples observations (usually things like request durations and response sizes) and can calculate configurable quantiles over a sliding time window.',
  },
  {
    value: 'unknown',
    description: 'These metrics have been given the type unknown in the metadata.',
  },
  {
    value: 'no type',
    description: 'These metrics have no defined type in the metadata.',
  },
];

export const placeholders = {
  browse: 'Search metrics by name',
  metadataSearchSwitch: 'Include description in search',
  type: 'Filter by type',
  includeNullMetadata: 'Include results with no metadata',
  setUseBackend: 'Enable regex search',
};
