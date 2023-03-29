import { chain, difference, once } from 'lodash';
import LRU from 'lru-cache';
import Prism from 'prismjs';
import { Value } from 'slate';

import {
  AbstractLabelMatcher,
  AbstractLabelOperator,
  AbstractQuery,
  dateTime,
  HistoryItem,
  LanguageProvider,
} from '@grafana/data';
import { BackendSrvRequest } from '@grafana/runtime';
import { CompletionItem, CompletionItemGroup, SearchFunctionType, TypeaheadInput, TypeaheadOutput } from '@grafana/ui';

import { Label } from './components/monaco-query-field/monaco-completion-provider/situation';
import { PrometheusDatasource } from './datasource';
import {
  addLimitInfo,
  extractLabelMatchers,
  fixSummariesMetadata,
  parseSelector,
  processHistogramMetrics,
  processLabels,
  roundSecToMin,
  toPromLikeQuery,
} from './language_utils';
import PromqlSyntax, { FUNCTIONS, RATE_RANGES } from './promql';
import { PromMetricsMetadata, PromQuery } from './types';

const DEFAULT_KEYS = ['job', 'instance'];
const EMPTY_SELECTOR = '{}';
const HISTORY_ITEM_COUNT = 5;
const HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h
// Max number of items (metrics, labels, values) that we display as suggestions. Prevents from running out of memory.
export const SUGGESTIONS_LIMIT = 10000;

const wrapLabel = (label: string): CompletionItem => ({ label });

const setFunctionKind = (suggestion: CompletionItem): CompletionItem => {
  suggestion.kind = 'function';
  return suggestion;
};

export function addHistoryMetadata(item: CompletionItem, history: any[]): CompletionItem {
  const cutoffTs = Date.now() - HISTORY_COUNT_CUTOFF;
  const historyForItem = history.filter((h) => h.ts > cutoffTs && h.query === item.label);
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
    item.documentation = getMetadataString(metric, metadata);
  }
  return item;
}

export function getMetadataString(metric: string, metadata: PromMetricsMetadata): string | undefined {
  if (!metadata[metric]) {
    return undefined;
  }
  const { type, help } = metadata[metric];
  return `${type.toUpperCase()}: ${help}`;
}

export function getMetadataHelp(metric: string, metadata: PromMetricsMetadata): string | undefined {
  if (!metadata[metric]) {
    return undefined;
  }
  return metadata[metric].help;
}

export function getMetadataType(metric: string, metadata: PromMetricsMetadata): string | undefined {
  if (!metadata[metric]) {
    return undefined;
  }
  return metadata[metric].type;
}

const PREFIX_DELIMITER_REGEX =
  /(="|!="|=~"|!~"|\{|\[|\(|\+|-|\/|\*|%|\^|\band\b|\bor\b|\bunless\b|==|>=|!=|<=|>|<|=|~|,)/;

interface AutocompleteContext {
  history?: Array<HistoryItem<PromQuery>>;
}
export default class PromQlLanguageProvider extends LanguageProvider {
  histogramMetrics: string[];
  timeRange?: { start: number; end: number };
  metrics: string[];
  metricsMetadata?: PromMetricsMetadata;
  declare startTask: Promise<any>;
  datasource: PrometheusDatasource;
  labelKeys: string[] = [];
  declare labelFetchTs: number;

  /**
   *  Cache for labels of series. This is bit simplistic in the sense that it just counts responses each as a 1 and does
   *  not account for different size of a response. If that is needed a `length` function can be added in the options.
   *  10 as a max size is totally arbitrary right now.
   */
  private labelsCache = new LRU<string, Record<string, string[]>>({ max: 10 });
  private labelValuesCache = new LRU<string, string[]>({ max: 10 });

  constructor(datasource: PrometheusDatasource, initialValues?: Partial<PromQlLanguageProvider>) {
    super();

    this.datasource = datasource;
    this.histogramMetrics = [];
    this.timeRange = { start: 0, end: 0 };
    this.metrics = [];

    Object.assign(this, initialValues);
  }

  // Strip syntax chars so that typeahead suggestions can work on clean inputs
  cleanText(s: string) {
    const parts = s.split(PREFIX_DELIMITER_REGEX);
    const last = parts.pop()!;
    return last.trimLeft().replace(/"$/, '').replace(/^"/, '');
  }

  get syntax() {
    return PromqlSyntax;
  }

  request = async (url: string, defaultValue: any, params = {}, options?: Partial<BackendSrvRequest>): Promise<any> => {
    try {
      const res = await this.datasource.metadataRequest(url, params, options);
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

    // TODO #33976: make those requests parallel
    await this.fetchLabels();
    this.metrics = (await this.fetchLabelValues('__name__')) || [];
    await this.loadMetricsMetadata();
    this.histogramMetrics = processHistogramMetrics(this.metrics).sort();
    return [];
  };

  async loadMetricsMetadata() {
    this.metricsMetadata = fixSummariesMetadata(
      await this.request('/api/v1/metadata', {}, {}, { showErrorAlert: false })
    );
  }

  getLabelKeys(): string[] {
    return this.labelKeys;
  }

  provideCompletionItems = async (
    { prefix, text, value, labelKey, wrapperClasses }: TypeaheadInput,
    context: AutocompleteContext = {}
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

  getBeginningCompletionItems = (context: AutocompleteContext): TypeaheadOutput => {
    return {
      suggestions: [...this.getEmptyCompletionItems(context).suggestions, ...this.getTermCompletionItems().suggestions],
    };
  };

  getEmptyCompletionItems = (context: AutocompleteContext): TypeaheadOutput => {
    const { history } = context;
    const suggestions: CompletionItemGroup[] = [];

    if (history && history.length) {
      const historyItems = chain(history)
        .map((h) => h.query.expr)
        .filter()
        .uniq()
        .take(HISTORY_ITEM_COUNT)
        .map(wrapLabel)
        .map((item) => addHistoryMetadata(item, history))
        .value();

      suggestions.push({
        searchFunctionType: SearchFunctionType.Prefix,
        skipSort: true,
        label: 'History',
        items: historyItems,
      });
    }

    return { suggestions };
  };

  getTermCompletionItems = (): TypeaheadOutput => {
    const { metrics, metricsMetadata } = this;
    const suggestions: CompletionItemGroup[] = [];

    suggestions.push({
      searchFunctionType: SearchFunctionType.Prefix,
      label: 'Functions',
      items: FUNCTIONS.map(setFunctionKind),
    });

    if (metrics && metrics.length) {
      suggestions.push({
        label: 'Metrics',
        items: metrics.map((m) => addMetricsMetadata(m, metricsMetadata)),
        searchFunctionType: SearchFunctionType.Fuzzy,
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
    const queryText = value.document.getBlocks().reduce((text, block) => {
      if (text === undefined) {
        return '';
      }
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

    const series = await this.getSeries(selector);
    const labelKeys = Object.keys(series);
    if (labelKeys.length > 0) {
      const limitInfo = addLimitInfo(labelKeys);
      suggestions.push({
        label: `Labels${limitInfo}`,
        items: labelKeys.map(wrapLabel),
        searchFunctionType: SearchFunctionType.Fuzzy,
      });
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
    const isValueEnd = suffix.match(/^"?[,}]|$/);
    // Detect cursor in front of value, e.g., {key=|"}
    const isPreValue = prefix.match(/(=|=~|!=|!~)$/) && suffix.match(/^"/);

    // Don't suggest anything at the beginning or inside a value
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

    let series: Record<string, string[]> = {};
    // Query labels for selector
    if (selector) {
      series = await this.getSeries(selector, !containsMetric);
    }

    if (Object.keys(series).length === 0) {
      console.warn(`Server did not return any values for selector = ${selector}`);
      return { suggestions };
    }

    let context: string | undefined;

    if ((text && isValueStart) || wrapperClasses.includes('attr-value')) {
      // Label values
      if (labelKey && series[labelKey]) {
        context = 'context-label-values';
        const limitInfo = addLimitInfo(series[labelKey]);
        suggestions.push({
          label: `Label values for "${labelKey}"${limitInfo}`,
          items: series[labelKey].map(wrapLabel),
          searchFunctionType: SearchFunctionType.Fuzzy,
        });
      }
    } else {
      // Label keys
      const labelKeys = series ? Object.keys(series) : containsMetric ? null : DEFAULT_KEYS;

      if (labelKeys) {
        const possibleKeys = difference(labelKeys, existingKeys);
        if (possibleKeys.length) {
          context = 'context-labels';
          const newItems = possibleKeys.map((key) => ({ label: key }));
          const limitInfo = addLimitInfo(newItems);
          const newSuggestion: CompletionItemGroup = {
            label: `Labels${limitInfo}`,
            items: newItems,
            searchFunctionType: SearchFunctionType.Fuzzy,
          };
          suggestions.push(newSuggestion);
        }
      }
    }

    return { context, suggestions };
  };

  importFromAbstractQuery(labelBasedQuery: AbstractQuery): PromQuery {
    return toPromLikeQuery(labelBasedQuery);
  }

  exportToAbstractQuery(query: PromQuery): AbstractQuery {
    const promQuery = query.expr;
    if (!promQuery || promQuery.length === 0) {
      return { refId: query.refId, labelMatchers: [] };
    }
    const tokens = Prism.tokenize(promQuery, PromqlSyntax);
    const labelMatchers: AbstractLabelMatcher[] = extractLabelMatchers(tokens);
    const nameLabelValue = getNameLabelValue(promQuery, tokens);
    if (nameLabelValue && nameLabelValue.length > 0) {
      labelMatchers.push({
        name: '__name__',
        operator: AbstractLabelOperator.Equal,
        value: nameLabelValue,
      });
    }

    return {
      refId: query.refId,
      labelMatchers,
    };
  }

  async getSeries(selector: string, withName?: boolean): Promise<Record<string, string[]>> {
    if (this.datasource.lookupsDisabled) {
      return {};
    }
    try {
      if (selector === EMPTY_SELECTOR) {
        return await this.fetchDefaultSeries();
      } else {
        return await this.fetchSeriesLabels(selector, withName);
      }
    } catch (error) {
      // TODO: better error handling
      console.error(error);
      return {};
    }
  }

  /**
   * @todo cache
   * @param key
   */
  fetchLabelValues = async (key: string): Promise<string[]> => {
    const params = this.datasource.getTimeRangeParams();
    const url = `/api/v1/label/${this.datasource.interpolateString(key)}/values`;
    return await this.request(url, [], params);
  };

  async getLabelValues(key: string): Promise<string[]> {
    return await this.fetchLabelValues(key);
  }

  /**
   * Fetches all label keys
   */
  async fetchLabels(): Promise<string[]> {
    const url = '/api/v1/labels';
    const params = this.datasource.getTimeRangeParams();
    this.labelFetchTs = Date.now().valueOf();

    const res = await this.request(url, [], params);
    if (Array.isArray(res)) {
      this.labelKeys = res.slice().sort();
    }

    return [];
  }

  /**
   * Gets series values
   * Function to replace old getSeries calls in a way that will provide faster endpoints for new prometheus instances,
   * while maintaining backward compatability
   * @param labelName
   * @param selector
   */
  getSeriesValues = async (labelName: string, selector: string): Promise<string[]> => {
    if (!this.datasource.hasLabelsMatchAPISupport()) {
      const data = await this.getSeries(selector);
      return data[labelName] ?? [];
    }
    return await this.fetchSeriesValuesWithMatch(labelName, selector);
  };

  /**
   * Fetches all values for a label, with optional match[]
   * @param name
   * @param match
   */
  fetchSeriesValuesWithMatch = async (name: string, match?: string): Promise<string[]> => {
    const interpolatedName = name ? this.datasource.interpolateString(name) : null;
    const range = this.datasource.getTimeRangeParams();
    const urlParams = {
      ...range,
      ...(match && { 'match[]': match }),
    };

    const cacheParams = new URLSearchParams({
      'match[]': interpolatedName ?? '',
      start: roundSecToMin(parseInt(range.start, 10)).toString(),
      end: roundSecToMin(parseInt(range.end, 10)).toString(),
      name: name,
    });

    const cacheKey = `/api/v1/label/?${cacheParams.toString()}/values`;
    let value: string[] | undefined = this.labelValuesCache.get(cacheKey);
    if (!value) {
      value = await this.request(`/api/v1/label/${interpolatedName}/values`, [], urlParams);
      if (value) {
        this.labelValuesCache.set(cacheKey, value);
      }
    }
    return value ?? [];
  };

  /**
   * Gets series labels
   * Function to replace old getSeries calls in a way that will provide faster endpoints for new prometheus instances,
   * while maintaining backward compatability. The old API call got the labels and the values in a single query,
   * but with the new query we need two calls, one to get the labels, and another to get the values.
   *
   * @param selector
   * @param otherLabels
   */
  getSeriesLabels = async (selector: string, otherLabels: Label[]): Promise<string[]> => {
    let possibleLabelNames, data: Record<string, string[]>;

    if (!this.datasource.hasLabelsMatchAPISupport()) {
      data = await this.getSeries(selector);
      possibleLabelNames = Object.keys(data); // all names from prometheus
    } else {
      // Exclude __name__ from output
      otherLabels.push({ name: '__name__', value: '', op: '!=' });
      data = await this.fetchSeriesLabelsMatch(selector);
      possibleLabelNames = Object.keys(data);
    }

    const usedLabelNames = new Set(otherLabels.map((l) => l.name)); // names used in the query
    return possibleLabelNames.filter((l) => !usedLabelNames.has(l));
  };

  /**
   * Fetch labels for a series using /series endpoint. This is cached by its args but also by the global timeRange currently selected as
   * they can change over requested time.
   * @param name
   * @param withName
   */
  fetchSeriesLabels = async (name: string, withName?: boolean): Promise<Record<string, string[]>> => {
    const interpolatedName = this.datasource.interpolateString(name);
    const range = this.datasource.getTimeRangeParams();
    const urlParams = {
      ...range,
      'match[]': interpolatedName,
    };
    const url = `/api/v1/series`;
    // Cache key is a bit different here. We add the `withName` param and also round up to a minute the intervals.
    // The rounding may seem strange but makes relative intervals like now-1h less prone to need separate request every
    // millisecond while still actually getting all the keys for the correct interval. This still can create problems
    // when user does not the newest values for a minute if already cached.
    const cacheParams = new URLSearchParams({
      'match[]': interpolatedName,
      start: roundSecToMin(parseInt(range.start, 10)).toString(),
      end: roundSecToMin(parseInt(range.end, 10)).toString(),
      withName: withName ? 'true' : 'false',
    });

    const cacheKey = `/api/v1/series?${cacheParams.toString()}`;
    let value = this.labelsCache.get(cacheKey);
    if (!value) {
      const data = await this.request(url, [], urlParams);
      const { values } = processLabels(data, withName);
      value = values;
      this.labelsCache.set(cacheKey, value);
    }
    return value;
  };

  /**
   * Fetch labels for a series using /labels endpoint.  This is cached by its args but also by the global timeRange currently selected as
   * they can change over requested time.
   * @param name
   * @param withName
   */
  fetchSeriesLabelsMatch = async (name: string, withName?: boolean): Promise<Record<string, string[]>> => {
    const interpolatedName = this.datasource.interpolateString(name);
    const range = this.datasource.getTimeRangeParams();
    const urlParams = {
      ...range,
      'match[]': interpolatedName,
    };
    const url = `/api/v1/labels`;
    // Cache key is a bit different here. We add the `withName` param and also round up to a minute the intervals.
    // The rounding may seem strange but makes relative intervals like now-1h less prone to need separate request every
    // millisecond while still actually getting all the keys for the correct interval. This still can create problems
    // when user does not the newest values for a minute if already cached.
    const cacheParams = new URLSearchParams({
      'match[]': interpolatedName,
      start: roundSecToMin(parseInt(range.start, 10)).toString(),
      end: roundSecToMin(parseInt(range.end, 10)).toString(),
      withName: withName ? 'true' : 'false',
    });

    const cacheKey = `${url}?${cacheParams.toString()}`;
    let value = this.labelsCache.get(cacheKey);
    if (!value) {
      const data: string[] = await this.request(url, [], urlParams);
      // Convert string array to Record<string , []>
      value = data.reduce((ac, a) => ({ ...ac, [a]: '' }), {});
      this.labelsCache.set(cacheKey, value);
    }
    return value;
  };

  /**
   * Fetch series for a selector. Use this for raw results. Use fetchSeriesLabels() to get labels.
   * @param match
   */
  fetchSeries = async (match: string): Promise<Array<Record<string, string>>> => {
    const url = '/api/v1/series';
    const range = this.datasource.getTimeRangeParams();
    const params = { ...range, 'match[]': match };
    return await this.request(url, {}, params);
  };

  /**
   * Fetch this only one as we assume this won't change over time. This is cached differently from fetchSeriesLabels
   * because we can cache more aggressively here and also we do not want to invalidate this cache the same way as in
   * fetchSeriesLabels.
   */
  fetchDefaultSeries = once(async () => {
    const values = await Promise.all(DEFAULT_KEYS.map((key) => this.fetchLabelValues(key)));
    return DEFAULT_KEYS.reduce((acc, key, i) => ({ ...acc, [key]: values[i] }), {});
  });
}

function getNameLabelValue(promQuery: string, tokens: any): string {
  let nameLabelValue = '';
  for (let prop in tokens) {
    if (typeof tokens[prop] === 'string') {
      nameLabelValue = tokens[prop] as string;
      break;
    }
  }
  return nameLabelValue;
}
