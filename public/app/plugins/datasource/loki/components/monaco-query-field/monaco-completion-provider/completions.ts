import type { Situation, Label } from './situation';
import { NeverCaseError } from './util';
// FIXME: we should not load this from the "outside", but we cannot do that while we have the "old" query-field too
import { FUNCTIONS } from '../../../syntax';
import { escapeLabelValueInExactSelector } from '../../../language_utils';

export type CompletionType = 'HISTORY' | 'FUNCTION' | 'METRIC_NAME' | 'DURATION' | 'LABEL_NAME' | 'LABEL_VALUE';

type Completion = {
  type: CompletionType;
  label: string;
  insertText: string;
  detail?: string;
  documentation?: string;
  triggerOnInsert?: boolean;
  isSnippet?: boolean;
};

export type DataProvider = {
  getHistory: () => Promise<string[]>;
  getAllLabelNames: () => Promise<string[]>;
  getLabelValues: (labelName: string) => Promise<string[]>;
  getSeriesLabels: (selector: string) => Promise<Record<string, string[]>>;
  getLogInfo: (selector: string) => Promise<{ labelKeys: string[]; hasJSON: boolean; hasLogfmt: boolean }>;
};

const LOG_COMPLETIONS: Completion[] = [
  {
    type: 'DURATION',
    label: '{}',
    insertText: '{$0}',
    isSnippet: true,
    triggerOnInsert: true,
  },
];

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

function makeSelector(labels: Label[]): string {
  const allLabelTexts = labels.map(
    (label) => `${label.name}${label.op}"${escapeLabelValueInExactSelector(label.value)}"`
  );

  return `{${allLabelTexts.join(',')}}`;
}

async function getLabelNames(otherLabels: Label[], dataProvider: DataProvider): Promise<string[]> {
  if (otherLabels.length === 0) {
    // if there is no filtering, we have to use a special endpoint
    return dataProvider.getAllLabelNames();
  } else {
    const selector = makeSelector(otherLabels);
    const data = await dataProvider.getSeriesLabels(selector);
    const possibleLabelNames = Object.keys(data); // all names from prometheus
    const usedLabelNames = new Set(otherLabels.map((l) => l.name)); // names used in the query
    return possibleLabelNames.filter((l) => !usedLabelNames.has(l));
  }
}

async function getLabelNamesForCompletions(
  suffix: string,
  triggerOnInsert: boolean,
  otherLabels: Label[],
  dataProvider: DataProvider
): Promise<Completion[]> {
  const labelNames = await getLabelNames(otherLabels, dataProvider);
  return labelNames.map((text) => ({
    type: 'LABEL_NAME',
    label: text,
    insertText: `${text}${suffix}`,
    triggerOnInsert,
  }));
}

async function getLabelNamesForSelectorCompletions(
  otherLabels: Label[],
  dataProvider: DataProvider
): Promise<Completion[]> {
  return getLabelNamesForCompletions('=', true, otherLabels, dataProvider);
}

async function getLabelNamesForByCompletions(otherLabels: Label[], dataProvider: DataProvider): Promise<Completion[]> {
  return getLabelNamesForCompletions('', true, otherLabels, dataProvider);
}

async function getLabelValues(labelName: string, otherLabels: Label[], dataProvider: DataProvider): Promise<string[]> {
  if (otherLabels.length === 0) {
    // if there is no filtering, we have to use a special endpoint
    return dataProvider.getLabelValues(labelName);
  } else {
    const selector = makeSelector(otherLabels);
    const data = await dataProvider.getSeriesLabels(selector);
    return data[labelName] ?? [];
  }
}

async function getAfterSelectorCompletions(
  labels: Label[],
  afterPipe: boolean,
  dataProvider: DataProvider
): Promise<Completion[]> {
  const result = await dataProvider.getLogInfo(makeSelector(labels));
  const allParsers = new Set(['json', 'logfmt', 'pattern', 'regexp', 'unpack']);
  const completions: Completion[] = [];
  const prefix = afterPipe ? '' : '| ';
  if (result.hasJSON) {
    allParsers.delete('json');
    completions.push({
      type: 'DURATION',
      label: 'json (detected)',
      insertText: `${prefix}json`,
    });
  }

  if (result.hasLogfmt) {
    allParsers.delete('logfmt');
    completions.push({
      type: 'DURATION',
      label: 'logfmt (detected)',
      insertText: `${prefix}logfmt`,
    });
  }

  const remainingParsers = Array.from(allParsers).sort();
  remainingParsers.forEach((parser) => {
    completions.push({
      type: 'DURATION',
      label: parser,
      insertText: `${prefix}${parser}`,
    });
  });
  return completions;
}

async function getLabelValuesForMetricCompletions(
  labelName: string,
  betweenQuotes: boolean,
  otherLabels: Label[],
  dataProvider: DataProvider
): Promise<Completion[]> {
  const values = await getLabelValues(labelName, otherLabels, dataProvider);
  return values.map((text) => ({
    type: 'LABEL_VALUE',
    label: text,
    insertText: betweenQuotes ? text : `"${text}"`, // FIXME: escaping strange characters?
  }));
}

export async function getCompletions(situation: Situation, dataProvider: DataProvider): Promise<Completion[]> {
  switch (situation.type) {
    case 'IN_DURATION':
      return DURATION_COMPLETIONS;
    case 'EMPTY': {
      const historyCompletions = await getAllHistoryCompletions(dataProvider);
      return [...historyCompletions, ...LOG_COMPLETIONS, ...FUNCTION_COMPLETIONS];
    }
    case 'IN_GROUPING':
      return getLabelNamesForByCompletions(situation.otherLabels, dataProvider);
    case 'IN_LABEL_SELECTOR_NO_LABEL_NAME':
      return getLabelNamesForSelectorCompletions(situation.otherLabels, dataProvider);
    case 'IN_LABEL_SELECTOR_WITH_LABEL_NAME':
      return getLabelValuesForMetricCompletions(
        situation.labelName,
        situation.betweenQuotes,
        situation.otherLabels,
        dataProvider
      );

    case 'AFTER_SELECTOR':
      return getAfterSelectorCompletions(situation.labels, situation.afterPipe, dataProvider);
    default:
      throw new NeverCaseError(situation);
  }
}
