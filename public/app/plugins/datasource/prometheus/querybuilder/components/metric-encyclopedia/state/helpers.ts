import { PrometheusDatasource } from 'app/plugins/datasource/prometheus/datasource';
import { getMetadataHelp, getMetadataType } from 'app/plugins/datasource/prometheus/language_provider';

import { promQueryModeller } from '../../../PromQueryModeller';
import { regexifyLabelValuesQueryString } from '../../../shared/parsingUtils';
import { QueryBuilderLabelFilter } from '../../../shared/types';
import { PromVisualQuery } from '../../../types';
import { HaystackDictionary, MetricData, MetricsData, PromFilterOption } from '../types';

import { Action, MetricEncyclopediaMetadata, MetricEncyclopediaState } from './state';

export async function getMetadata(
  datasource: PrometheusDatasource,
  query: PromVisualQuery
): Promise<MetricEncyclopediaMetadata> {
  // Makes sure we loaded the metadata for metrics. Usually this is done in the start() method of the provider but we
  // don't use it with the visual builder and there is no need to run all the start() setup anyway.
  if (!datasource.languageProvider.metricsMetadata) {
    await datasource.languageProvider.loadMetricsMetadata();
  }

  // Error handling for when metrics metadata returns as undefined
  // *** Will have to handle metadata filtering if this happens
  // *** only display metrics fuzzy search, filter and pagination
  let hasMetadata = true;
  if (!datasource.languageProvider.metricsMetadata) {
    hasMetadata = false;
    // setHasMetadata(false);
    datasource.languageProvider.metricsMetadata = {};
  }

  // filter by adding the query.labels to the search?
  // *** do this in the filter???
  let metrics;
  if (query.labels.length > 0) {
    const expr = promQueryModeller.renderLabels(query.labels);
    metrics = (await datasource.languageProvider.getSeries(expr, true))['__name__'] ?? [];
  } else {
    metrics = (await datasource.languageProvider.getLabelValues('__name__')) ?? [];
  }

  let nameHaystackDictionaryData: HaystackDictionary = {};
  let metaHaystackDictionaryData: HaystackDictionary = {};

  let metricsData: MetricsData = metrics.map((m: string) => {
    const type = getMetadataType(m, datasource.languageProvider.metricsMetadata!);
    const description = getMetadataHelp(m, datasource.languageProvider.metricsMetadata!);

    // string[] = name + type + description
    const metaDataString = `${m} ${type} ${description}`;

    const metricData: MetricData = {
      value: m,
      type: type,
      description: description,
    };

    nameHaystackDictionaryData[m] = metricData;
    metaHaystackDictionaryData[metaDataString] = metricData;

    return metricData;
  });

  return {
    isLoading: false,
    hasMetadata: hasMetadata,
    metrics: metricsData,
    metaHaystackDictionary: metaHaystackDictionaryData,
    nameHaystackDictionary: nameHaystackDictionaryData,
    totalMetricCount: metricsData.length,
    filteredMetricCount: metricsData.length,
  };
}

/**
 * The filtered and paginated metrics displayed in the modal
 * */
export function displayedMetrics(state: MetricEncyclopediaState, dispatch: React.Dispatch<Action>) {
  const filteredSorted: MetricsData = filterMetrics(state);

  if (!state.isLoading && state.filteredMetricCount !== filteredSorted.length) {
    dispatch({
      type: 'setFilteredMetricCount',
      payload: filteredSorted.length,
    });
  }

  return sliceMetrics(filteredSorted, state.pageNum, state.resultsPerPage);
}

/**
 * Filter the metrics with all the options, fuzzy, type, letter
 * @param metrics
 * @param skipLetterSearch used to show the alphabet letters as clickable before filtering out letters (needs to be refactored)
 * @returns
 */
export function filterMetrics(state: MetricEncyclopediaState, skipLetterSearch?: boolean): MetricsData {
  let filteredMetrics: MetricsData = state.metrics;

  if (state.fuzzySearchQuery && !state.useBackend) {
    if (state.fullMetaSearch) {
      filteredMetrics = state.metaHaystackOrder.map((needle: string) => state.metaHaystackDictionary[needle]);
    } else {
      filteredMetrics = state.nameHaystackOrder.map((needle: string) => state.nameHaystackDictionary[needle]);
    }
  }

  if (state.letterSearch && !skipLetterSearch) {
    filteredMetrics = filteredMetrics.filter((m: MetricData, idx) => {
      const letters: string[] = [state.letterSearch, state.letterSearch.toLowerCase()];
      return letters.includes(m.value[0]);
    });
  }

  if (state.selectedTypes.length > 0 && !state.useBackend) {
    filteredMetrics = filteredMetrics.filter((m: MetricData, idx) => {
      // Matches type
      const matchesSelectedType = state.selectedTypes.some((t) => t.value === m.type);

      // missing type
      const hasNoType = !m.type;

      return matchesSelectedType || (hasNoType && !state.excludeNullMetadata);
    });
  }

  if (state.excludeNullMetadata) {
    filteredMetrics = filteredMetrics.filter((m: MetricData) => {
      return m.type !== undefined && m.description !== undefined;
    });
  }

  return filteredMetrics;
}

export function calculatePageList(state: MetricEncyclopediaState) {
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
 * @param metricText
 * @param labels
 * @param datasource
 * @returns
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
    return results.map((result) => {
      return {
        value: result.text,
      };
    });
  });
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
];

export const placeholders = {
  browse: 'Search metrics by name',
  metadataSearchSwitch: 'Search by metadata type and description in addition to name',
  type: 'Select...',
  variables: 'Select...',
  excludeNoMetadata: 'Exclude results with no metadata',
  setUseBackend: 'Use the backend to browse metrics',
};
