import _ from 'lodash';

import { dateTime, LanguageProvider, HistoryItem } from '@grafana/data';
import { CompletionItem, TypeaheadInput, TypeaheadOutput, CompletionItemGroup } from '@grafana/ui';

import { parseSelector, processLabels, processHistogramLabels } from './language_utils';
import PromqlSyntax, { FUNCTIONS, RATE_RANGES } from './promql';

import { PrometheusDatasource } from './datasource';
import { PromQuery } from './types';

const DEFAULT_KEYS = ['job', 'instance'];
const EMPTY_SELECTOR = '{}';
const HISTORY_ITEM_COUNT = 5;
const HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h

const wrapLabel = (label: string): CompletionItem => ({ label });

const setFunctionKind = (suggestion: CompletionItem): CompletionItem => {
  suggestion.kind = 'function';
  return suggestion;
};

export function addHistoryMetadata(item: CompletionItem, history: any[]): CompletionItem {
  const cutoffTs = Date.now() - HISTORY_COUNT_CUTOFF;
  const historyForItem = history.filter(h => h.ts > cutoffTs && h.query === item.label);
  const count = historyForItem.length;
  const recent = historyForItem[0];
  let hint = `Queried ${count} times in the last 24h.`;

  if (recent) {
    const lastQueried = dateTime(recent.ts).fromNow();
    hint = `${hint} Last queried ${lastQueried}.`;
  }

  return {
    ...item,
    documentation: hint,
  };
}

export default class PromQlLanguageProvider extends LanguageProvider {
  histogramMetrics?: string[];
  timeRange?: { start: number; end: number };
  labelKeys?: { [index: string]: string[] }; // metric -> [labelKey,...]
  labelValues?: { [index: string]: { [index: string]: string[] } }; // metric -> labelKey -> [labelValue,...]
  metrics?: string[];
  startTask: Promise<any>;
  datasource: PrometheusDatasource;

  constructor(datasource: PrometheusDatasource, initialValues?: any) {
    super();

    this.datasource = datasource;
    this.histogramMetrics = [];
    this.timeRange = { start: 0, end: 0 };
    this.labelKeys = {};
    this.labelValues = {};
    this.metrics = [];

    Object.assign(this, initialValues);
  }

  // Strip syntax chars
  cleanText = (s: string) => s.replace(/[{}[\]="(),!~+\-*/^%]/g, '').trim();

  get syntax() {
    return PromqlSyntax;
  }

  request = async (url: string) => {
    try {
      const res = await this.datasource.metadataRequest(url);
      const body = await (res.data || res.json());

      return body.data;
    } catch (error) {
      console.error(error);
    }

    return [];
  };

  start = () => {
    if (!this.startTask) {
      this.startTask = this.fetchMetrics();
    }
    return this.startTask;
  };

  fetchMetrics = async () => {
    this.metrics = await this.fetchMetricNames();
    this.processHistogramMetrics(this.metrics);

    return Promise.resolve([]);
  };

  fetchMetricNames = async (): Promise<string[]> => {
    return this.request('/api/v1/label/__name__/values');
  };

  processHistogramMetrics = (data: string[]) => {
    const { values } = processHistogramLabels(data);

    if (values && values['__name__']) {
      this.histogramMetrics = values['__name__'].slice().sort();
    }
  };

  provideCompletionItems = async (
    { prefix, text, value, labelKey, wrapperClasses }: TypeaheadInput,
    context: { history: Array<HistoryItem<PromQuery>> } = { history: [] }
  ): Promise<TypeaheadOutput> => {
    // Local text properties
    const empty = value.document.text.length === 0;
    const selectedLines = value.document.getTextsAtRange(value.selection);
    const currentLine = selectedLines.size === 1 ? selectedLines.first().getText() : null;

    const nextCharacter = currentLine ? currentLine[value.selection.anchor.offset] : null;

    // Syntax spans have 3 classes by default. More indicate a recognized token
    const tokenRecognized = wrapperClasses.length > 3;
    // Non-empty prefix, but not inside known token
    const prefixUnrecognized = prefix && !tokenRecognized;

    // Prevent suggestions in `function(|suffix)`
    const noSuffix = !nextCharacter || nextCharacter === ')';

    // Empty prefix is safe if it does not immediately follow a complete expression and has no text after it
    const safeEmptyPrefix = prefix === '' && !text.match(/^[\]})\s]+$/) && noSuffix;

    // About to type next operand if preceded by binary operator
    const operatorsPattern = /[+\-*/^%]/;
    const isNextOperand = text.match(operatorsPattern);

    // Determine candidates by CSS context
    if (wrapperClasses.includes('context-range')) {
      // Suggestions for metric[|]
      return this.getRangeCompletionItems();
    } else if (wrapperClasses.includes('context-labels')) {
      // Suggestions for metric{|} and metric{foo=|}, as well as metric-independent label queries like {|}
      return this.getLabelCompletionItems({ prefix, text, value, labelKey, wrapperClasses });
    } else if (wrapperClasses.includes('context-aggregation')) {
      // Suggestions for sum(metric) by (|)
      return this.getAggregationCompletionItems({ prefix, text, value, labelKey, wrapperClasses });
    } else if (empty) {
      // Suggestions for empty query field
      return this.getEmptyCompletionItems(context);
    } else if ((prefixUnrecognized && noSuffix) || safeEmptyPrefix || isNextOperand) {
      // Show term suggestions in a couple of scenarios
      return this.getTermCompletionItems();
    }

    return {
      suggestions: [],
    };
  };

  getEmptyCompletionItems = (context: { history: Array<HistoryItem<PromQuery>> }): TypeaheadOutput => {
    const { history } = context;
    const suggestions = [];

    if (history && history.length) {
      const historyItems = _.chain(history)
        .map(h => h.query.expr)
        .filter()
        .uniq()
        .take(HISTORY_ITEM_COUNT)
        .map(wrapLabel)
        .map(item => addHistoryMetadata(item, history))
        .value();

      suggestions.push({
        prefixMatch: true,
        skipSort: true,
        label: 'History',
        items: historyItems,
      });
    }

    const termCompletionItems = this.getTermCompletionItems();
    suggestions.push(...termCompletionItems.suggestions);

    return { suggestions };
  };

  getTermCompletionItems = (): TypeaheadOutput => {
    const { metrics } = this;
    const suggestions = [];

    suggestions.push({
      prefixMatch: true,
      label: 'Functions',
      items: FUNCTIONS.map(setFunctionKind),
    });

    if (metrics && metrics.length) {
      suggestions.push({
        label: 'Metrics',
        items: metrics.map(wrapLabel),
      });
    }

    return { suggestions };
  };

  getRangeCompletionItems(): TypeaheadOutput {
    return {
      context: 'context-range',
      suggestions: [
        {
          label: 'Range vector',
          items: [...RATE_RANGES],
        },
      ],
    };
  }

  roundToMinutes(seconds: number): number {
    return Math.floor(seconds / 60);
  }

  timeRangeChanged(): boolean {
    const dsRange = this.datasource.getTimeRange();
    return (
      this.roundToMinutes(dsRange.end) !== this.roundToMinutes(this.timeRange.end) ||
      this.roundToMinutes(dsRange.start) !== this.roundToMinutes(this.timeRange.start)
    );
  }

  getAggregationCompletionItems = ({ value }: TypeaheadInput): TypeaheadOutput => {
    const refresher: Promise<any> = null;
    const suggestions: CompletionItemGroup[] = [];

    // Stitch all query lines together to support multi-line queries
    let queryOffset;
    const queryText = value.document.getBlocks().reduce((text: string, block) => {
      const blockText = block.getText();
      if (value.anchorBlock.key === block.key) {
        // Newline characters are not accounted for but this is irrelevant
        // for the purpose of extracting the selector string
        queryOffset = value.selection.anchor.offset + text.length;
      }

      return text + blockText;
    }, '');

    // Try search for selector part on the left-hand side, such as `sum (m) by (l)`
    const openParensAggregationIndex = queryText.lastIndexOf('(', queryOffset);
    let openParensSelectorIndex = queryText.lastIndexOf('(', openParensAggregationIndex - 1);
    let closeParensSelectorIndex = queryText.indexOf(')', openParensSelectorIndex);

    // Try search for selector part of an alternate aggregation clause, such as `sum by (l) (m)`
    if (openParensSelectorIndex === -1) {
      const closeParensAggregationIndex = queryText.indexOf(')', queryOffset);
      closeParensSelectorIndex = queryText.indexOf(')', closeParensAggregationIndex + 1);
      openParensSelectorIndex = queryText.lastIndexOf('(', closeParensSelectorIndex);
    }

    const result = {
      refresher,
      suggestions,
      context: 'context-aggregation',
    };

    // Suggestions are useless for alternative aggregation clauses without a selector in context
    if (openParensSelectorIndex === -1) {
      return result;
    }

    // Range vector syntax not accounted for by subsequent parse so discard it if present
    const selectorString = queryText
      .slice(openParensSelectorIndex + 1, closeParensSelectorIndex)
      .replace(/\[[^\]]+\]$/, '');

    const selector = parseSelector(selectorString, selectorString.length - 2).selector;

    const labelKeys = this.labelKeys[selector];
    if (labelKeys && !this.timeRangeChanged()) {
      suggestions.push({ label: 'Labels', items: labelKeys.map(wrapLabel) });
    } else {
      result.refresher = this.fetchSeriesLabels(selector);
    }

    return result;
  };

  getLabelCompletionItems = async ({
    text,
    wrapperClasses,
    labelKey,
    value,
  }: TypeaheadInput): Promise<TypeaheadOutput> => {
    const line = value.anchorBlock.getText();
    const cursorOffset = value.selection.anchor.offset;

    // Get normalized selector
    let selector;
    let parsedSelector;
    try {
      parsedSelector = parseSelector(line, cursorOffset);
      selector = parsedSelector.selector;
    } catch {
      selector = EMPTY_SELECTOR;
    }

    const containsMetric = selector.includes('__name__=');
    const existingKeys = parsedSelector ? parsedSelector.labelKeys : [];

    // Query labels for selector
    if (selector && (!this.labelValues[selector] || this.timeRangeChanged())) {
      if (selector === EMPTY_SELECTOR) {
        // Query label values for default labels
        await Promise.all(DEFAULT_KEYS.map(key => this.fetchLabelValues(key)));
      } else {
        await this.fetchSeriesLabels(selector, !containsMetric);
      }
    }

    const suggestions = [];
    let context: string;
    if ((text && text.match(/^!?=~?/)) || wrapperClasses.includes('attr-value')) {
      // Label values
      if (labelKey && this.labelValues[selector] && this.labelValues[selector][labelKey]) {
        const labelValues = this.labelValues[selector][labelKey];
        context = 'context-label-values';
        suggestions.push({
          label: `Label values for "${labelKey}"`,
          items: labelValues.map(wrapLabel),
        });
      }
    } else {
      // Label keys
      const labelKeys = this.labelKeys[selector] || (containsMetric ? null : DEFAULT_KEYS);

      if (labelKeys) {
        const possibleKeys = _.difference(labelKeys, existingKeys);
        if (possibleKeys.length) {
          context = 'context-labels';
          const newItems = possibleKeys.map(key => ({ label: key }));
          const newSuggestion: CompletionItemGroup = { label: `Labels`, items: newItems };
          suggestions.push(newSuggestion);
        }
      }
    }

    return { context, suggestions };
  };

  fetchLabelValues = async (key: string) => {
    try {
      const data = await this.request(`/api/v1/label/${key}/values`);
      const existingValues = this.labelValues[EMPTY_SELECTOR];
      const values = {
        ...existingValues,
        [key]: data,
      };
      this.labelValues[EMPTY_SELECTOR] = values;
    } catch (e) {
      console.error(e);
    }
  };

  fetchSeriesLabels = async (name: string, withName?: boolean) => {
    try {
      const tRange = this.datasource.getTimeRange();
      const data = await this.request(`/api/v1/series?match[]=${name}&start=${tRange['start']}&end=${tRange['end']}`);
      const { keys, values } = processLabels(data, withName);
      this.labelKeys[name] = keys;
      this.labelValues[name] = values;
      this.timeRange = tRange;
    } catch (e) {
      console.error(e);
    }
  };
}
