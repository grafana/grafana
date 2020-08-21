import _ from 'lodash';
import LRU from 'lru-cache';
import { Value } from 'slate';

import { dateTime, HistoryItem, LanguageProvider } from '@grafana/data';
import { CompletionItem, CompletionItemGroup, TypeaheadInput, TypeaheadOutput } from '@grafana/ui';

import { fixSummariesMetadata, parseSelector, processHistogramLabels, processLabels } from './language_utils';
import PromqlSyntax, { FUNCTIONS, RATE_RANGES } from './promql';

import { PrometheusDatasource } from './datasource';
import { PromMetricsMetadata, PromQuery } from './types';

const DEFAULT_KEYS = ['job', 'instance'];
const EMPTY_SELECTOR = '{}';
const HISTORY_ITEM_COUNT = 5;
const HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h
export const DEFAULT_LOOKUP_METRICS_THRESHOLD = 10000; // number of metrics defining an installation that's too big

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

function addMetricsMetadata(metric: string, metadata?: PromMetricsMetadata): CompletionItem {
  const item: CompletionItem = { label: metric };
  if (metadata && metadata[metric]) {
    const { type, help } = metadata[metric][0];
    item.documentation = `${type.toUpperCase()}: ${help}`;
  }
  return item;
}

const PREFIX_DELIMITER_REGEX = /(="|!="|=~"|!~"|\{|\[|\(|\+|-|\/|\*|%|\^|\band\b|\bor\b|\bunless\b|==|>=|!=|<=|>|<|=|~|,)/;

export default class PromQlLanguageProvider extends LanguageProvider {
  histogramMetrics: string[];
  timeRange?: { start: number; end: number };
  metrics: string[];
  metricsMetadata?: PromMetricsMetadata;
  startTask: Promise<any>;
  datasource: PrometheusDatasource;
  lookupMetricsThreshold: number;
  lookupsDisabled: boolean; // Dynamically set to true for big/slow instances

  /**
   *  Cache for labels of series. This is bit simplistic in the sense that it just counts responses each as a 1 and does
   *  not account for different size of a response. If that is needed a `length` function can be added in the options.
   *  10 as a max size is totally arbitrary right now.
   */
  private labelsCache = new LRU<string, Record<string, string[]>>(10);

  constructor(datasource: PrometheusDatasource, initialValues?: Partial<PromQlLanguageProvider>) {
    super();

    this.datasource = datasource;
    this.histogramMetrics = [];
    this.timeRange = { start: 0, end: 0 };
    this.metrics = [];
    // Disable lookups until we know the instance is small enough
    this.lookupMetricsThreshold = DEFAULT_LOOKUP_METRICS_THRESHOLD;
    this.lookupsDisabled = true;

    Object.assign(this, initialValues);
  }

  // Strip syntax chars so that typeahead suggestions can work on clean inputs
  cleanText(s: string) {
    const parts = s.split(PREFIX_DELIMITER_REGEX);
    const last = parts.pop()!;
    return last
      .trimLeft()
      .replace(/"$/, '')
      .replace(/^"/, '');
  }

  get syntax() {
    return PromqlSyntax;
  }

  request = async (url: string, defaultValue: any): Promise<any> => {
    try {
      const res = await this.datasource.metadataRequest(url);
      return res.data.data;
    } catch (error) {
      console.error(error);
    }

    return defaultValue;
  };

  start = async (): Promise<any[]> => {
    if (this.datasource.lookupsDisabled) {
      return [];
    }

    this.metrics = await this.request('/api/v1/label/__name__/values', []);
    this.lookupsDisabled = this.metrics.length > this.lookupMetricsThreshold;
    this.metricsMetadata = fixSummariesMetadata(await this.request('/api/v1/metadata', {}));
    this.processHistogramMetrics(this.metrics);

    return [];
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
    const emptyResult: TypeaheadOutput = { suggestions: [] };

    if (!value) {
      return emptyResult;
    }

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

    // Prefix is safe if it does not immediately follow a complete expression and has no text after it
    const safePrefix = prefix && !text.match(/^[\]})\s]+$/) && noSuffix;

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
      return this.getAggregationCompletionItems(value);
    } else if (empty) {
      // Suggestions for empty query field
      return this.getEmptyCompletionItems(context);
    } else if (prefixUnrecognized && noSuffix && !isNextOperand) {
      // Show term suggestions in a couple of scenarios
      return this.getBeginningCompletionItems(context);
    } else if (prefixUnrecognized && safePrefix) {
      // Show term suggestions in a couple of scenarios
      return this.getTermCompletionItems();
    }

    return emptyResult;
  };

  getBeginningCompletionItems = (context: { history: Array<HistoryItem<PromQuery>> }): TypeaheadOutput => {
    return {
      suggestions: [...this.getEmptyCompletionItems(context).suggestions, ...this.getTermCompletionItems().suggestions],
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

    return { suggestions };
  };

  getTermCompletionItems = (): TypeaheadOutput => {
    const { metrics, metricsMetadata } = this;
    const suggestions = [];

    suggestions.push({
      prefixMatch: true,
      label: 'Functions',
      items: FUNCTIONS.map(setFunctionKind),
    });

    if (metrics && metrics.length) {
      suggestions.push({
        label: 'Metrics',
        items: metrics.map(m => addMetricsMetadata(m, metricsMetadata)),
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

  getAggregationCompletionItems = async (value: Value): Promise<TypeaheadOutput> => {
    const suggestions: CompletionItemGroup[] = [];

    // Stitch all query lines together to support multi-line queries
    let queryOffset;
    const queryText = value.document.getBlocks().reduce((text: string, block) => {
      if (!block) {
        return text;
      }

      const blockText = block?.getText();

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

    const labelValues = await this.getLabelValues(selector);
    if (labelValues) {
      suggestions.push({ label: 'Labels', items: Object.keys(labelValues).map(wrapLabel) });
    }
    return result;
  };

  getLabelCompletionItems = async ({
    text,
    wrapperClasses,
    labelKey,
    value,
  }: TypeaheadInput): Promise<TypeaheadOutput> => {
    if (!value) {
      return { suggestions: [] };
    }

    const suggestions: CompletionItemGroup[] = [];
    const line = value.anchorBlock.getText();
    const cursorOffset = value.selection.anchor.offset;
    const suffix = line.substr(cursorOffset);
    const prefix = line.substr(0, cursorOffset);
    const isValueStart = text.match(/^(=|=~|!=|!~)/);
    const isValueEnd = suffix.match(/^"?[,}]/);
    // detect cursor in front of value, e.g., {key=|"}
    const isPreValue = prefix.match(/(=|=~|!=|!~)$/) && suffix.match(/^"/);

    // Don't suggestq anything at the beginning or inside a value
    const isValueEmpty = isValueStart && isValueEnd;
    const hasValuePrefix = isValueEnd && !isValueStart;
    if ((!isValueEmpty && !hasValuePrefix) || isPreValue) {
      return { suggestions };
    }

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

    let labelValues;
    // Query labels for selector
    if (selector) {
      labelValues = await this.getLabelValues(selector, !containsMetric);
    }

    if (!labelValues) {
      console.warn(`Server did not return any values for selector = ${selector}`);
      return { suggestions };
    }

    let context: string | undefined;

    if ((text && isValueStart) || wrapperClasses.includes('attr-value')) {
      // Label values
      if (labelKey && labelValues[labelKey]) {
        context = 'context-label-values';
        suggestions.push({
          label: `Label values for "${labelKey}"`,
          items: labelValues[labelKey].map(wrapLabel),
        });
      }
    } else {
      // Label keys
      const labelKeys = labelValues ? Object.keys(labelValues) : containsMetric ? null : DEFAULT_KEYS;

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

  async getLabelValues(selector: string, withName?: boolean) {
    if (this.lookupsDisabled) {
      return undefined;
    }
    try {
      if (selector === EMPTY_SELECTOR) {
        return await this.fetchDefaultLabels();
      } else {
        return await this.fetchSeriesLabels(selector, withName);
      }
    } catch (error) {
      // TODO: better error handling
      console.error(error);
      return undefined;
    }
  }

  fetchLabelValues = async (key: string): Promise<Record<string, string[]>> => {
    const data = await this.request(`/api/v1/label/${key}/values`, []);
    return { [key]: data };
  };

  roundToMinutes(seconds: number): number {
    return Math.floor(seconds / 60);
  }

  /**
   * Fetch labels for a series. This is cached by it's args but also by the global timeRange currently selected as
   * they can change over requested time.
   * @param name
   * @param withName
   */
  fetchSeriesLabels = async (name: string, withName?: boolean): Promise<Record<string, string[]>> => {
    const tRange = this.datasource.getTimeRange();
    const params = new URLSearchParams({
      'match[]': name,
      start: tRange['start'].toString(),
      end: tRange['end'].toString(),
    });
    const url = `/api/v1/series?${params.toString()}`;
    // Cache key is a bit different here. We add the `withName` param and also round up to a minute the intervals.
    // The rounding may seem strange but makes relative intervals like now-1h less prone to need separate request every
    // millisecond while still actually getting all the keys for the correct interval. This still can create problems
    // when user does not the newest values for a minute if already cached.
    params.set('start', this.roundToMinutes(tRange['start']).toString());
    params.set('end', this.roundToMinutes(tRange['end']).toString());
    params.append('withName', withName ? 'true' : 'false');
    const cacheKey = `/api/v1/series?${params.toString()}`;
    let value = this.labelsCache.get(cacheKey);
    if (!value) {
      const data = await this.request(url, []);
      const { values } = processLabels(data, withName);
      value = values;
      this.labelsCache.set(cacheKey, value);
    }
    return value;
  };

  /**
   * Fetch this only one as we assume this won't change over time. This is cached differently from fetchSeriesLabels
   * because we can cache more aggressively here and also we do not want to invalidate this cache the same way as in
   * fetchSeriesLabels.
   */
  fetchDefaultLabels = _.once(async () => {
    const values = await Promise.all(DEFAULT_KEYS.map(key => this.fetchLabelValues(key)));
    return values.reduce((acc, value) => ({ ...acc, ...value }), {});
  });
}
