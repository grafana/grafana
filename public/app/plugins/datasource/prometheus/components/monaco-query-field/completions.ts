import type { Intent, Label } from './intent';
import { HistoryItem } from '@grafana/data';
import { PromQuery } from '../../types';
import type LangProvider from '../../language_provider';
import { NeverCaseError } from './util';
import { FUNCTIONS } from '../../promql';

type PromHistoryItem = HistoryItem<PromQuery>;

type Completion = {
  label: string;
  insertText: string;
  triggerOnInsert?: boolean;
};

// we order items like: history, functions, metrics

async function getAllMetricNamesCompletions(langProvider: LangProvider): Promise<Completion[]> {
  const { metricsMetadata } = langProvider;
  const texts = metricsMetadata == null ? [] : Object.keys(metricsMetadata);
  return texts.map((text) => ({
    label: text,
    insertText: text,
  }));
}

function getAllFunctionsCompletions(): Completion[] {
  return FUNCTIONS.map((f) => ({
    label: f.label,
    insertText: f.insertText ?? '', // i don't know what to do when this is nullish. it should not be.
  }));
}

function getAllDurationsCompletions(): Completion[] {
  // FIXME: get a better list
  return ['5m', '1m', '30s', '15s'].map((text) => ({
    label: text,
    insertText: text,
  }));
}

function getAllHistoryCompletions(queryHistory: PromHistoryItem[]): Completion[] {
  // NOTE: the typescript types are wrong. historyItem.query.expr can be undefined
  const exprs = queryHistory
    .map((h) => h.query.expr)
    .filter((expr) => expr !== undefined)
    .slice(0, 10); // FIXME: better limit

  return exprs.map((expr) => ({
    label: expr,
    insertText: expr,
  }));
}

function makeSelector(metricName: string, labels: Label[]): string {
  // FIXME: check if this deals well with usually-escaped-non-ascii things
  const labelTexts = labels.map((label) => `${label.name}="${label.value}"`);
  return `{__name__="${metricName}",${labelTexts.join(',')}}`;
}

async function getLabelNamesForCompletions(
  metric: string,
  suffix: string,
  triggerOnInsert: boolean,
  otherLabels: Label[],
  langProvider: LangProvider
): Promise<Completion[]> {
  const selector = makeSelector(metric, otherLabels);
  const data = await langProvider.getSeries(selector);
  const possibleLabelNames = Object.keys(data); // all names from prometheus
  const usedLabelNames = new Set(otherLabels.map((l) => l.name)); // names used in the query
  const labelNames = possibleLabelNames.filter((l) => !usedLabelNames.has(l));
  return labelNames.map((text) => ({
    label: text,
    insertText: `${text}${suffix}`,
    triggerOnInsert,
  }));
}

async function getLabelNamesForSelectorCompletions(
  metric: string,
  otherLabels: Label[],
  langProvider: LangProvider
): Promise<Completion[]> {
  return getLabelNamesForCompletions(metric, '=', true, otherLabels, langProvider);
}
async function getLabelNamesForByCompletions(
  metric: string,
  otherLabels: Label[],
  langProvider: LangProvider
): Promise<Completion[]> {
  return getLabelNamesForCompletions(metric, '', false, otherLabels, langProvider);
}

async function getLabelValuesForMetricCompletions(
  metric: string,
  labelName: string,
  otherLabels: Label[],
  langProvider: LangProvider
): Promise<Completion[]> {
  const selector = makeSelector(metric, otherLabels);
  const data = await langProvider.getSeries(selector);
  const values = data[labelName] ?? [];
  return values.map((text) => ({
    label: text,
    insertText: `"${text}"`, // FIXME: escaping strange characters?
  }));
}

export async function getCompletions(
  intent: Intent,
  langProvider: LangProvider,
  queryHistory: PromHistoryItem[]
): Promise<Completion[]> {
  switch (intent.type) {
    case 'ALL_DURATIONS':
      return getAllDurationsCompletions();
    case 'ALL_METRIC_NAMES':
      return getAllMetricNamesCompletions(langProvider);
    case 'FUNCTIONS_AND_ALL_METRIC_NAMES': {
      const metricNames = await getAllMetricNamesCompletions(langProvider);
      return [...getAllFunctionsCompletions(), ...metricNames];
    }
    case 'HISTORY_AND_FUNCTIONS_AND_ALL_METRIC_NAMES': {
      const metricNames = await getAllMetricNamesCompletions(langProvider);
      return [...getAllHistoryCompletions(queryHistory), ...getAllFunctionsCompletions(), ...metricNames];
    }
    case 'LABEL_NAMES_FOR_SELECTOR':
      return getLabelNamesForSelectorCompletions(intent.metricName, intent.otherLabels, langProvider);
    case 'LABEL_NAMES_FOR_BY':
      return getLabelNamesForByCompletions(intent.metricName, intent.otherLabels, langProvider);
    case 'LABEL_VALUES':
      return getLabelValuesForMetricCompletions(intent.metricName, intent.labelName, intent.otherLabels, langProvider);
    default:
      throw new NeverCaseError(intent);
  }
}
