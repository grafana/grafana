import { PrometheusDatasource } from '../../../datasource';
import { getMetadataHelp, getMetadataType } from '../../../language_provider';
import { promQueryModeller } from '../../PromQueryModeller';
import { PromVisualQuery } from '../../types';

import { MetricEncyclopediaState } from './MetricEncyclopediaModal';
import { HaystackDictionary, MetricData, MetricsData } from './types';

export async function getMetadata(
  datasource: PrometheusDatasource,
  query: PromVisualQuery
): Promise<MetricEncyclopediaState> {
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

  let metaHaystackData: string[] = [];
  let nameHaystackData: string[] = [];

  let nameHaystackDictionaryData: HaystackDictionary = {};
  let metaHaystackDictionaryData: HaystackDictionary = {};

  let metricsData: MetricsData = metrics.map((m: string) => {
    const type = getMetadataType(m, datasource.languageProvider.metricsMetadata!);
    const description = getMetadataHelp(m, datasource.languageProvider.metricsMetadata!);

    // string[] = name + type + description
    const metaDataString = `${m} ${type} ${description}`;
    metaHaystackData.push(metaDataString);
    nameHaystackData.push(m);

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
    metaHaystack: metaHaystackData,
    nameHaystack: nameHaystackData,
    metaHaystackDictionary: metaHaystackDictionaryData,
    nameHaystackDictionary: nameHaystackDictionaryData,
    totalMetricCount: metricsData.length,
    filteredMetricCount: metricsData.length,
  };
}

export function alphabetCheck() {
  const alphabetDict: { [char: string]: number } = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    F: 0,
    G: 0,
    H: 0,
    I: 0,
    J: 0,
    K: 0,
    L: 0,
    M: 0,
    N: 0,
    O: 0,
    P: 0,
    Q: 0,
    R: 0,
    S: 0,
    T: 0,
    U: 0,
    V: 0,
    W: 0,
    X: 0,
    Y: 0,
    Z: 0,
  };

  return alphabetDict;
}

export const alphabet = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
];
