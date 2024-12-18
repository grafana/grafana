// Core grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/monaco-query-field/monaco-completion-provider/completions.ts
import UFuzzy from '@leeoniya/ufuzzy';

import { config } from '@grafana/runtime';

import { prometheusRegularEscape } from '../../../datasource';
import { escapeLabelValueInExactSelector } from '../../../language_utils';
import { FUNCTIONS } from '../../../promql';

import { DataProvider } from './data_provider';
import type { Label, Situation } from './situation';
import { NeverCaseError } from './util';
// FIXME: we should not load this from the "outside", but we cannot do that while we have the "old" query-field too

export type CompletionType = 'HISTORY' | 'FUNCTION' | 'METRIC_NAME' | 'DURATION' | 'LABEL_NAME' | 'LABEL_VALUE';

type Completion = {
  type: CompletionType;
  label: string;
  insertText: string;
  detail?: string;
  documentation?: string;
  triggerOnInsert?: boolean;
};

const metricNamesSearch = {
  // see https://github.com/leeoniya/uFuzzy?tab=readme-ov-file#how-it-works for details
  multiInsert: new UFuzzy({ intraMode: 0 }),
  singleError: new UFuzzy({ intraMode: 1 }),
};

interface MetricFilterOptions {
  metricNames: string[];
  inputText: string;
  limit: number;
}

export function filterMetricNames({ metricNames, inputText, limit }: MetricFilterOptions): string[] {
  if (!inputText?.trim()) {
    return metricNames.slice(0, limit);
  }

  const terms = metricNamesSearch.multiInsert.split(inputText); // e.g. 'some_metric_name or-another' -> ['some', 'metric', 'name', 'or', 'another']
  const isComplexSearch = terms.length > 4;
  const fuzzyResults = isComplexSearch
    ? metricNamesSearch.multiInsert.filter(metricNames, inputText) // for complex searches, prioritize performance by using MultiInsert fuzzy search
    : metricNamesSearch.singleError.filter(metricNames, inputText); // for simple searches, prioritize flexibility by using SingleError fuzzy search

  return fuzzyResults ? fuzzyResults.slice(0, limit).map((idx) => metricNames[idx]) : [];
}

// we order items like: history, functions, metrics
function getAllMetricNamesCompletions(dataProvider: DataProvider): Completion[] {
  let metricNames = dataProvider.getAllMetricNames();

  if (
    config.featureToggles.prometheusCodeModeMetricNamesSearch &&
    metricNames.length > dataProvider.metricNamesSuggestionLimit
  ) {
    const { monacoSettings } = dataProvider;
    monacoSettings.enableAutocompleteSuggestionsUpdate();

    if (monacoSettings.inputInRange) {
      metricNames = filterMetricNames({
        metricNames,
        inputText: monacoSettings.inputInRange,
        limit: dataProvider.metricNamesSuggestionLimit,
      });
    } else {
      metricNames = metricNames.slice(0, dataProvider.metricNamesSuggestionLimit);
    }
  }

  return dataProvider.metricNamesToMetrics(metricNames).map((metric) => ({
    type: 'METRIC_NAME',
    label: metric.name,
    insertText: metric.name,
    detail: `${metric.name} : ${metric.type}`,
    documentation: metric.help,
  }));
}

const FUNCTION_COMPLETIONS: Completion[] = FUNCTIONS.map((f) => ({
  type: 'FUNCTION',
  label: f.label,
  insertText: f.insertText ?? '', // i don't know what to do when this is nullish. it should not be.
  detail: f.detail,
  documentation: f.documentation,
}));

async function getAllFunctionsAndMetricNamesCompletions(dataProvider: DataProvider): Promise<Completion[]> {
  const metricNames = getAllMetricNamesCompletions(dataProvider);

  return [...FUNCTION_COMPLETIONS, ...metricNames];
}

const DURATION_COMPLETIONS: Completion[] = [
  '$__interval',
  '$__range',
  '$__rate_interval',
  '1m',
  '5m',
  '10m',
  '30m',
  '1h',
  '1d',
].map((text) => ({
  type: 'DURATION',
  label: text,
  insertText: text,
}));

function getAllHistoryCompletions(dataProvider: DataProvider): Completion[] {
  // function getAllHistoryCompletions(queryHistory: PromHistoryItem[]): Completion[] {
  // NOTE: the typescript types are wrong. historyItem.query.expr can be undefined
  const allHistory = dataProvider.getHistory();
  // FIXME: find a better history-limit
  return allHistory.slice(0, 10).map((expr) => ({
    type: 'HISTORY',
    label: expr,
    insertText: expr,
  }));
}

function makeSelector(metricName: string | undefined, labels: Label[]): string {
  const allLabels = [...labels];

  // we transform the metricName to a label, if it exists
  if (metricName !== undefined) {
    allLabels.push({ name: '__name__', value: metricName, op: '=' });
  }

  const allLabelTexts = allLabels.map(
    (label) => `${label.name}${label.op}"${escapeLabelValueInExactSelector(label.value)}"`
  );

  return `{${allLabelTexts.join(',')}}`;
}

async function getLabelNames(
  metric: string | undefined,
  otherLabels: Label[],
  dataProvider: DataProvider
): Promise<string[]> {
  if (metric === undefined && otherLabels.length === 0) {
    // if there is no filtering, we have to use a special endpoint
    return Promise.resolve(dataProvider.getAllLabelNames());
  } else {
    const selector = makeSelector(metric, otherLabels);
    return await dataProvider.getSeriesLabels(selector, otherLabels);
  }
}

async function getLabelNamesForCompletions(
  metric: string | undefined,
  suffix: string,
  triggerOnInsert: boolean,
  otherLabels: Label[],
  dataProvider: DataProvider
): Promise<Completion[]> {
  const labelNames = await getLabelNames(metric, otherLabels, dataProvider);
  return labelNames.map((text) => ({
    type: 'LABEL_NAME',
    label: text,
    insertText: `${text}${suffix}`,
    triggerOnInsert,
  }));
}

async function getLabelNamesForSelectorCompletions(
  metric: string | undefined,
  otherLabels: Label[],
  dataProvider: DataProvider
): Promise<Completion[]> {
  return getLabelNamesForCompletions(metric, '=', true, otherLabels, dataProvider);
}

async function getLabelNamesForByCompletions(
  metric: string | undefined,
  otherLabels: Label[],
  dataProvider: DataProvider
): Promise<Completion[]> {
  return getLabelNamesForCompletions(metric, '', false, otherLabels, dataProvider);
}

async function getLabelValues(
  metric: string | undefined,
  labelName: string,
  otherLabels: Label[],
  dataProvider: DataProvider
): Promise<string[]> {
  if (metric === undefined && otherLabels.length === 0) {
    // if there is no filtering, we have to use a special endpoint
    return dataProvider.getLabelValues(labelName);
  } else {
    const selector = makeSelector(metric, otherLabels);
    return await dataProvider.getSeriesValues(labelName, selector);
  }
}

async function getLabelValuesForMetricCompletions(
  metric: string | undefined,
  labelName: string,
  betweenQuotes: boolean,
  otherLabels: Label[],
  dataProvider: DataProvider
): Promise<Completion[]> {
  const values = await getLabelValues(metric, labelName, otherLabels, dataProvider);
  return values.map((text) => ({
    type: 'LABEL_VALUE',
    label: text,
    insertText: formatLabelValueForCompletion(text, betweenQuotes),
  }));
}

function formatLabelValueForCompletion(value: string, betweenQuotes: boolean): string {
  const text = config.featureToggles.prometheusSpecialCharsInLabelValues ? prometheusRegularEscape(value) : value;
  return betweenQuotes ? text : `"${text}"`;
}

export function getCompletions(situation: Situation, dataProvider: DataProvider): Promise<Completion[]> {
  switch (situation.type) {
    case 'IN_DURATION':
      return Promise.resolve(DURATION_COMPLETIONS);
    case 'IN_FUNCTION':
      return getAllFunctionsAndMetricNamesCompletions(dataProvider);
    case 'AT_ROOT': {
      return getAllFunctionsAndMetricNamesCompletions(dataProvider);
    }
    case 'EMPTY': {
      const metricNames = getAllMetricNamesCompletions(dataProvider);
      const historyCompletions = getAllHistoryCompletions(dataProvider);
      return Promise.resolve([...historyCompletions, ...FUNCTION_COMPLETIONS, ...metricNames]);
    }
    case 'IN_LABEL_SELECTOR_NO_LABEL_NAME':
      return getLabelNamesForSelectorCompletions(situation.metricName, situation.otherLabels, dataProvider);
    case 'IN_GROUPING':
      return getLabelNamesForByCompletions(situation.metricName, situation.otherLabels, dataProvider);
    case 'IN_LABEL_SELECTOR_WITH_LABEL_NAME':
      return getLabelValuesForMetricCompletions(
        situation.metricName,
        situation.labelName,
        situation.betweenQuotes,
        situation.otherLabels,
        dataProvider
      );
    default:
      throw new NeverCaseError(situation);
  }
}
