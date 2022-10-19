import { escapeLabelValueInExactSelector } from '../../../languageUtils';
import { AGGREGATION_OPERATORS, RANGE_VEC_FUNCTIONS } from '../../../syntax';

import { CompletionDataProvider } from './CompletionDataProvider';
import { NeverCaseError } from './NeverCaseError';
import type { Situation, Label } from './situation';

export type CompletionType =
  | 'HISTORY'
  | 'FUNCTION'
  | 'DURATION'
  | 'LABEL_NAME'
  | 'LABEL_VALUE'
  | 'PATTERN'
  | 'PARSER'
  | 'LINE_FILTER'
  | 'PIPE_OPERATION';

type Completion = {
  type: CompletionType;
  label: string;
  insertText: string;
  detail?: string;
  documentation?: string;
  triggerOnInsert?: boolean;
  isSnippet?: boolean;
};

const LOG_COMPLETIONS: Completion[] = [
  {
    type: 'PATTERN',
    label: '{}',
    insertText: '{$0}',
    isSnippet: true,
    triggerOnInsert: true,
  },
];

const AGGREGATION_COMPLETIONS: Completion[] = AGGREGATION_OPERATORS.map((f) => ({
  type: 'FUNCTION',
  label: f.label,
  insertText: `${f.insertText ?? ''}($0)`, // i don't know what to do when this is nullish. it should not be.
  isSnippet: true,
  triggerOnInsert: true,
  detail: f.detail,
  documentation: f.documentation,
}));

const FUNCTION_COMPLETIONS: Completion[] = RANGE_VEC_FUNCTIONS.map((f) => ({
  type: 'FUNCTION',
  label: f.label,
  insertText: `${f.insertText ?? ''}({$0}[\\$__interval])`, // i don't know what to do when this is nullish. it should not be.
  isSnippet: true,
  triggerOnInsert: true,
  detail: f.detail,
  documentation: f.documentation,
}));

const DURATION_COMPLETIONS: Completion[] = ['$__interval', '$__range', '1m', '5m', '10m', '30m', '1h', '1d'].map(
  (text) => ({
    type: 'DURATION',
    label: text,
    insertText: text,
  })
);

const LINE_FILTER_COMPLETIONS = [
  {
    operator: '|=',
    documentation: 'Log line contains string',
    afterPipe: true,
  },
  {
    operator: '!=',
    documentation: 'Log line does not contain string',
  },
  {
    operator: '|~',
    documentation: 'Log line contains a match to the regular expression',
    afterPipe: true,
  },
  {
    operator: '!~',
    documentation: 'Log line does not contain a match to the regular expression',
  },
];

function getLineFilterCompletions(afterPipe: boolean): Completion[] {
  return LINE_FILTER_COMPLETIONS.filter((completion) => !afterPipe || completion.afterPipe).map(
    ({ operator, documentation }) => ({
      type: 'LINE_FILTER',
      label: `${operator} ""`,
      insertText: `${afterPipe ? operator.replace('|', '') : operator} "$0"`,
      isSnippet: true,
      documentation,
    })
  );
}

async function getAllHistoryCompletions(dataProvider: CompletionDataProvider): Promise<Completion[]> {
  const history = await dataProvider.getHistory();

  return history.map((expr) => ({
    type: 'HISTORY',
    label: expr,
    insertText: expr,
  }));
}

async function getLabelNamesForCompletions(
  suffix: string,
  triggerOnInsert: boolean,
  addExtractedLabels: boolean,
  otherLabels: Label[],
  dataProvider: CompletionDataProvider
): Promise<Completion[]> {
  const labelNames = await dataProvider.getLabelNames(otherLabels);
  const result: Completion[] = labelNames.map((text) => ({
    type: 'LABEL_NAME',
    label: text,
    insertText: `${text}${suffix}`,
    triggerOnInsert,
  }));

  if (addExtractedLabels) {
    const { extractedLabelKeys } = await dataProvider.getParserAndLabelKeys(otherLabels);
    extractedLabelKeys.forEach((key) => {
      result.push({
        type: 'LABEL_NAME',
        label: `${key} (parsed)`,
        insertText: `${key}${suffix}`,
        triggerOnInsert,
      });
    });
  }

  return result;
}

async function getLabelNamesForSelectorCompletions(
  otherLabels: Label[],
  dataProvider: CompletionDataProvider
): Promise<Completion[]> {
  return getLabelNamesForCompletions('=', true, false, otherLabels, dataProvider);
}

async function getInGroupingCompletions(
  otherLabels: Label[],
  dataProvider: CompletionDataProvider
): Promise<Completion[]> {
  return getLabelNamesForCompletions('', false, true, otherLabels, dataProvider);
}

const PARSERS = ['json', 'logfmt', 'pattern', 'regexp', 'unpack'];
const PARSER_DOCUMENTATION = 'Parse and extract labels from the log content.';

async function getAfterSelectorCompletions(
  labels: Label[],
  afterPipe: boolean,
  dataProvider: CompletionDataProvider
): Promise<Completion[]> {
  const { extractedLabelKeys, hasJSON, hasLogfmt } = await dataProvider.getParserAndLabelKeys(labels);
  const allParsers = new Set(PARSERS);
  const completions: Completion[] = [];
  const prefix = afterPipe ? ' ' : '| ';
  const hasLevelInExtractedLabels = extractedLabelKeys.some((key) => key === 'level');
  if (hasJSON) {
    allParsers.delete('json');
    const extra = hasLevelInExtractedLabels ? '' : ' (detected)';
    completions.push({
      type: 'PARSER',
      label: `json${extra}`,
      insertText: `${prefix}json`,
      documentation: hasLevelInExtractedLabels ? 'Use it to get log-levels in the histogram' : PARSER_DOCUMENTATION,
    });
  }

  if (hasLogfmt) {
    allParsers.delete('logfmt');
    const extra = hasLevelInExtractedLabels ? '' : ' (detected)';
    completions.push({
      type: 'DURATION',
      label: `logfmt${extra}`,
      insertText: `${prefix}logfmt`,
      documentation: hasLevelInExtractedLabels ? 'Get detected levels in the histogram' : PARSER_DOCUMENTATION,
    });
  }

  const remainingParsers = Array.from(allParsers).sort();
  remainingParsers.forEach((parser) => {
    completions.push({
      type: 'PARSER',
      label: parser,
      insertText: `${prefix}${parser}`,
      documentation: PARSER_DOCUMENTATION,
    });
  });

  extractedLabelKeys.forEach((key) => {
    completions.push({
      type: 'LINE_FILTER',
      label: `unwrap ${key} (detected)`,
      insertText: `${prefix}unwrap ${key}`,
    });
  });

  completions.push({
    type: 'PIPE_OPERATION',
    label: 'unwrap',
    insertText: `${prefix}unwrap`,
  });

  completions.push({
    type: 'PIPE_OPERATION',
    label: 'line_format',
    insertText: `${prefix}line_format "{{.$0}}"`,
    isSnippet: true,
  });

  completions.push({
    type: 'PIPE_OPERATION',
    label: 'label_format',
    insertText: `${prefix}label_format`,
    isSnippet: true,
  });

  return [...getLineFilterCompletions(afterPipe), ...completions];
}

async function getLabelValuesForMetricCompletions(
  labelName: string,
  betweenQuotes: boolean,
  otherLabels: Label[],
  dataProvider: CompletionDataProvider
): Promise<Completion[]> {
  const values = await dataProvider.getLabelValues(labelName, otherLabels);
  return values.map((text) => ({
    type: 'LABEL_VALUE',
    label: text,
    insertText: betweenQuotes ? escapeLabelValueInExactSelector(text) : `"${escapeLabelValueInExactSelector(text)}"`,
  }));
}

export async function getCompletions(
  situation: Situation,
  dataProvider: CompletionDataProvider
): Promise<Completion[]> {
  switch (situation.type) {
    case 'EMPTY':
    case 'AT_ROOT':
      const historyCompletions = await getAllHistoryCompletions(dataProvider);
      return [...historyCompletions, ...LOG_COMPLETIONS, ...AGGREGATION_COMPLETIONS, ...FUNCTION_COMPLETIONS];
    case 'IN_DURATION':
      return DURATION_COMPLETIONS;
    case 'IN_GROUPING':
      return getInGroupingCompletions(situation.otherLabels, dataProvider);
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
    case 'IN_AGGREGATION':
      return [...FUNCTION_COMPLETIONS, ...AGGREGATION_COMPLETIONS];
    default:
      throw new NeverCaseError(situation);
  }
}
