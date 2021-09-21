import type { Intent, Label } from './intent';
import { NeverCaseError } from './util';
// FIXME: we should not load this from the "outside", but we cannot do that while we have the "old" query-field too
import { FUNCTIONS } from '../../../promql';

export type CompletionType = 'HISTORY' | 'FUNCTION' | 'METRIC_NAME' | 'DURATION' | 'LABEL_NAME' | 'LABEL_VALUE';

type Completion = {
  type: CompletionType;
  label: string;
  insertText: string;
  detail?: string;
  documentation?: string;
  triggerOnInsert?: boolean;
};

type Metric = {
  name: string;
  help: string;
  type: string;
};

export type DataProvider = {
  getHistory: () => Promise<string[]>;
  getAllMetricNames: () => Promise<Metric[]>;
  getSeries: (selector: string) => Promise<Record<string, string[]>>;
};

// we order items like: history, functions, metrics

async function getAllMetricNamesCompletions(dataProvider: DataProvider): Promise<Completion[]> {
  const metrics = await dataProvider.getAllMetricNames();
  return metrics.map((metric) => ({
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

async function getAllHistoryCompletions(dataProvider: DataProvider): Promise<Completion[]> {
  // function getAllHistoryCompletions(queryHistory: PromHistoryItem[]): Completion[] {
  // NOTE: the typescript types are wrong. historyItem.query.expr can be undefined
  const allHistory = await dataProvider.getHistory();
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
    allLabels.push({ name: '__name__', value: metricName });
  }

  const allLabelTexts = allLabels.map((label) => `${label.name}="${label.value}"`);

  return `{${allLabelTexts.join(',')}}`;
}

async function getLabelNamesForCompletions(
  metric: string | undefined,
  suffix: string,
  triggerOnInsert: boolean,
  otherLabels: Label[],
  dataProvider: DataProvider
): Promise<Completion[]> {
  const selector = makeSelector(metric, otherLabels);
  const data = await dataProvider.getSeries(selector);
  const possibleLabelNames = Object.keys(data); // all names from prometheus
  const usedLabelNames = new Set(otherLabels.map((l) => l.name)); // names used in the query
  const labelNames = possibleLabelNames.filter((l) => !usedLabelNames.has(l));
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

async function getLabelValuesForMetricCompletions(
  metric: string | undefined,
  labelName: string,
  otherLabels: Label[],
  dataProvider: DataProvider
): Promise<Completion[]> {
  const selector = makeSelector(metric, otherLabels);
  const data = await dataProvider.getSeries(selector);
  const values = data[labelName] ?? [];
  return values.map((text) => ({
    type: 'LABEL_VALUE',
    label: text,
    insertText: `"${text}"`, // FIXME: escaping strange characters?
  }));
}

export async function getCompletions(intent: Intent, dataProvider: DataProvider): Promise<Completion[]> {
  switch (intent.type) {
    case 'ALL_DURATIONS':
      return DURATION_COMPLETIONS;
    case 'ALL_METRIC_NAMES':
      return getAllMetricNamesCompletions(dataProvider);
    case 'FUNCTIONS_AND_ALL_METRIC_NAMES': {
      const metricNames = await getAllMetricNamesCompletions(dataProvider);
      return [...FUNCTION_COMPLETIONS, ...metricNames];
    }
    case 'HISTORY_AND_FUNCTIONS_AND_ALL_METRIC_NAMES': {
      const metricNames = await getAllMetricNamesCompletions(dataProvider);
      const historyCompletions = await getAllHistoryCompletions(dataProvider);
      return [...historyCompletions, ...FUNCTION_COMPLETIONS, ...metricNames];
    }
    case 'LABEL_NAMES_FOR_SELECTOR':
      return getLabelNamesForSelectorCompletions(intent.metricName, intent.otherLabels, dataProvider);
    case 'LABEL_NAMES_FOR_BY':
      return getLabelNamesForByCompletions(intent.metricName, intent.otherLabels, dataProvider);
    case 'LABEL_VALUES':
      return getLabelValuesForMetricCompletions(intent.metricName, intent.labelName, intent.otherLabels, dataProvider);
    default:
      throw new NeverCaseError(intent);
  }
}
