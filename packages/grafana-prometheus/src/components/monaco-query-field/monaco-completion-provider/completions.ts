// Core grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/monaco-query-field/monaco-completion-provider/completions.ts
import UFuzzy from '@leeoniya/ufuzzy';
import { languages } from 'monaco-editor';

import { TimeRange } from '@grafana/data';
import { config } from '@grafana/runtime';

import { DEFAULT_COMPLETION_LIMIT } from '../../../constants';
import { escapeLabelValueInExactSelector, prometheusRegularEscape } from '../../../escaping';
import { getFunctions } from '../../../promql';
import { isValidLegacyName } from '../../../utf8_support';

import { DataProvider } from './data_provider';
import { TriggerType } from './monaco-completion-provider';
import type { Label, Situation } from './situation';
import { NeverCaseError } from './util';
// FIXME: we should not load this from the "outside", but we cannot do that while we have the "old" query-field too

export type CompletionType = 'HISTORY' | 'FUNCTION' | 'METRIC_NAME' | 'DURATION' | 'LABEL_NAME' | 'LABEL_VALUE';

// We cannot use languages.CompletionItemInsertTextRule.InsertAsSnippet because grafana-prometheus package isn't compatible
// It should first change the moduleResolution to bundler for TS to correctly resolve the types
// https://github.com/grafana/grafana/pull/96450
const InsertAsSnippet = 4;

type Completion = {
  type: CompletionType;
  label: string;
  insertText: string;
  insertTextRules?: languages.CompletionItemInsertTextRule;
  detail?: string;
  documentation?: string;
  triggerOnInsert?: boolean;
};

const metricNamesSearch = {
  // see https://github.com/leeoniya/uFuzzy?tab=readme-ov-file#how-it-works for details
  multiInsert: new UFuzzy({ intraMode: 0 }),
  singleError: new UFuzzy({ intraMode: 1 }),
};

// Snippet Marker is  telling monaco where to show the cursor and maybe a help text
// With help text example: ${1:labelName}
// labelName will be shown as selected. So user would know what to type next
const snippetMarker = '${1:}';

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
async function getAllMetricNamesCompletions(
  searchTerm: string | undefined,
  dataProvider: DataProvider,
  timeRange: TimeRange
): Promise<Completion[]> {
  if (dataProvider.languageProvider.datasource.lazyLoading) {
    if (!searchTerm || searchTerm.length < dataProvider.languageProvider.datasource.lazyLoadingLengthThreshold) {
      return [];
    }
  }
  let metricNames = await dataProvider.queryMetricNames(timeRange, searchTerm);

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
    detail: `${metric.name} : ${metric.type}`,
    documentation: metric.help,
    ...(metric.isUtf8
      ? {
          insertText: `{"${metric.name}"${snippetMarker}}`,
          insertTextRules: InsertAsSnippet,
        }
      : {
          insertText: metric.name,
        }),
  }));
}

const getFunctionCompletions: () => Completion[] = () => {
  return getFunctions().map((f) => ({
    type: 'FUNCTION',
    label: f.label,
    insertText: f.insertText ?? '', // i don't know what to do when this is nullish. it should not be.
    detail: f.detail,
    documentation: f.documentation,
  }));
};

async function getFunctionsOnlyCompletions(): Promise<Completion[]> {
  return Promise.resolve(getFunctionCompletions());
}

async function getAllFunctionsAndMetricNamesCompletions(
  searchTerm: string | undefined,
  dataProvider: DataProvider,
  timeRange: TimeRange
): Promise<Completion[]> {
  const metricNames = await getAllMetricNamesCompletions(searchTerm, dataProvider, timeRange);
  return [...getFunctionCompletions(), ...metricNames];
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

function makeSelector(metricName: string | undefined, labels: Label[]): string | undefined {
  if (metricName === undefined && labels.length === 0) {
    return undefined;
  }

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
  dataProvider: DataProvider,
  timeRange: TimeRange
): Promise<string[]> {
  const selector = makeSelector(metric, otherLabels);
  const labelNames = await dataProvider.queryLabelKeys(timeRange, selector, DEFAULT_COMPLETION_LIMIT);
  // Exclude __name__ from output
  otherLabels.push({ name: '__name__', value: '', op: '!=' });
  const usedLabelNames = new Set(otherLabels.map((l) => l.name));
  // names used in the query
  return labelNames.filter((l) => !usedLabelNames.has(l));
}

async function getLabelNamesForCompletions(
  metric: string | undefined,
  suffix: string,
  triggerOnInsert: boolean,
  otherLabels: Label[],
  dataProvider: DataProvider,
  timeRange: TimeRange
): Promise<Completion[]> {
  const labelNames = await getLabelNames(metric, otherLabels, dataProvider, timeRange);
  return labelNames.map((text) => {
    const isUtf8 = !isValidLegacyName(text);
    return {
      type: 'LABEL_NAME',
      label: text,
      ...(isUtf8
        ? {
            insertText: `"${text}"${suffix}`,
            insertTextRules: InsertAsSnippet,
          }
        : {
            insertText: `${text}${suffix}`,
          }),
      triggerOnInsert,
    };
  });
}

async function getLabelNamesForSelectorCompletions(
  metric: string | undefined,
  otherLabels: Label[],
  dataProvider: DataProvider,
  timeRange: TimeRange
): Promise<Completion[]> {
  return getLabelNamesForCompletions(metric, '=', true, otherLabels, dataProvider, timeRange);
}

async function getLabelNamesForByCompletions(
  metric: string | undefined,
  otherLabels: Label[],
  dataProvider: DataProvider,
  timeRange: TimeRange
): Promise<Completion[]> {
  return getLabelNamesForCompletions(metric, '', false, otherLabels, dataProvider, timeRange);
}

async function getLabelValues(
  metric: string | undefined,
  labelName: string,
  otherLabels: Label[],
  dataProvider: DataProvider,
  timeRange: TimeRange
): Promise<string[]> {
  const selector = makeSelector(metric, otherLabels);
  return await dataProvider.queryLabelValues(timeRange, labelName, selector);
}

async function getLabelValuesForMetricCompletions(
  metric: string | undefined,
  labelName: string,
  betweenQuotes: boolean,
  otherLabels: Label[],
  dataProvider: DataProvider,
  timeRange: TimeRange
): Promise<Completion[]> {
  const values = await getLabelValues(metric, labelName, otherLabels, dataProvider, timeRange);
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

export async function getCompletions(
  situation: Situation,
  dataProvider: DataProvider,
  timeRange: TimeRange,
  searchTerm?: string,
  triggerType: TriggerType = 'full'
): Promise<Completion[]> {
  switch (situation.type) {
    case 'IN_DURATION':
      return Promise.resolve(DURATION_COMPLETIONS);
    case 'IN_FUNCTION':
      return triggerType === 'full'
        ? getAllFunctionsAndMetricNamesCompletions(searchTerm, dataProvider, timeRange)
        : getFunctionsOnlyCompletions();
    case 'AT_ROOT': {
      return triggerType === 'full'
        ? getAllFunctionsAndMetricNamesCompletions(searchTerm, dataProvider, timeRange)
        : getFunctionsOnlyCompletions();
    }
    case 'EMPTY': {
      if (triggerType === 'partial') {
        return Promise.resolve(getFunctionCompletions());
      }
      const metricNames = await getAllMetricNamesCompletions(searchTerm, dataProvider, timeRange);
      const historyCompletions = getAllHistoryCompletions(dataProvider);
      return Promise.resolve([...historyCompletions, ...getFunctionCompletions(), ...metricNames]);
    }
    case 'IN_LABEL_SELECTOR_NO_LABEL_NAME':
      return getLabelNamesForSelectorCompletions(situation.metricName, situation.otherLabels, dataProvider, timeRange);
    case 'IN_GROUPING':
      return getLabelNamesForByCompletions(situation.metricName, situation.otherLabels, dataProvider, timeRange);
    case 'IN_LABEL_SELECTOR_WITH_LABEL_NAME':
      return getLabelValuesForMetricCompletions(
        situation.metricName,
        situation.labelName,
        situation.betweenQuotes,
        situation.otherLabels,
        dataProvider,
        timeRange
      );
    default:
      throw new NeverCaseError(situation);
  }
}
