import { chain, difference } from 'lodash';
import LRU from 'lru-cache';
import Prism, { Grammar } from 'prismjs';

import { dateTime, AbsoluteTimeRange, LanguageProvider, HistoryItem, AbstractQuery } from '@grafana/data';
import { CompletionItem, TypeaheadInput, TypeaheadOutput, CompletionItemGroup } from '@grafana/ui';
import {
  extractLabelMatchers,
  parseSelector,
  processLabels,
  toPromLikeExpr,
} from 'app/plugins/datasource/prometheus/language_utils';

import { LokiDatasource } from './datasource';
import {
  extractLabelKeysFromDataFrame,
  extractLogParserFromDataFrame,
  extractUnwrapLabelKeysFromDataFrame,
} from './responseUtils';
import syntax, { FUNCTIONS, PIPE_PARSERS, PIPE_OPERATORS } from './syntax';
import { LokiQuery, LokiQueryType } from './types';

const DEFAULT_KEYS = ['job', 'namespace'];
const EMPTY_SELECTOR = '{}';
const HISTORY_ITEM_COUNT = 10;
const HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h
const NS_IN_MS = 1000000;

// When changing RATE_RANGES, check if Prometheus/PromQL ranges should be changed too
// @see public/app/plugins/datasource/prometheus/promql.ts
const RATE_RANGES: CompletionItem[] = [
  { label: '$__interval', sortValue: '$__interval' },
  { label: '$__range', sortValue: '$__range' },
  { label: '1m', sortValue: '00:01:00' },
  { label: '5m', sortValue: '00:05:00' },
  { label: '10m', sortValue: '00:10:00' },
  { label: '30m', sortValue: '00:30:00' },
  { label: '1h', sortValue: '01:00:00' },
  { label: '1d', sortValue: '24:00:00' },
];

export const LABEL_REFRESH_INTERVAL = 1000 * 30; // 30sec

const wrapLabel = (label: string) => ({ label, filterText: `\"${label}\"` });

export type LokiHistoryItem = HistoryItem<LokiQuery>;

type TypeaheadContext = {
  history?: LokiHistoryItem[];
  absoluteRange?: AbsoluteTimeRange;
};

export function addHistoryMetadata(item: CompletionItem, history: LokiHistoryItem[]): CompletionItem {
  const cutoffTs = Date.now() - HISTORY_COUNT_CUTOFF;
  const historyForItem = history.filter((h) => h.ts > cutoffTs && h.query.expr === item.label);
  let hint = `Queried ${historyForItem.length} times in the last 24h.`;
  const recent = historyForItem[0];

  if (recent) {
    const lastQueried = dateTime(recent.ts).fromNow();
    hint = `${hint} Last queried ${lastQueried}.`;
  }

  return {
    ...item,
    documentation: hint,
  };
}

export default class LokiLanguageProvider extends LanguageProvider {
  labelKeys: string[];
  labelFetchTs: number;
  started = false;
  datasource: LokiDatasource;
  lookupsDisabled = false; // Dynamically set to true for big/slow instances

  /**
   *  Cache for labels of series. This is bit simplistic in the sense that it just counts responses each as a 1 and does
   *  not account for different size of a response. If that is needed a `length` function can be added in the options.
   *  10 as a max size is totally arbitrary right now.
   */
  private seriesCache = new LRU<string, Record<string, string[]>>({ max: 10 });
  private labelsCache = new LRU<string, string[]>({ max: 10 });

  constructor(datasource: LokiDatasource, initialValues?: any) {
    super();

    this.datasource = datasource;
    this.labelKeys = [];
    this.labelFetchTs = 0;

    Object.assign(this, initialValues);
  }

  // Strip syntax chars
  cleanText = (s: string) => s.replace(/[{}[\]="(),!~+\-*/^%\|]/g, '').trim();

  getSyntax(): Grammar {
    return syntax;
  }

  request = async (url: string, params?: any): Promise<any> => {
    try {
      return await this.datasource.metadataRequest(url, params);
    } catch (error) {
      console.error(error);
    }

    return undefined;
  };

  /**
   * Initialise the language provider by fetching set of labels. Without this initialisation the provider would return
   * just a set of hardcoded default labels on provideCompletionItems or a recent queries from history.
   */
  start = () => {
    if (!this.startTask) {
      this.startTask = this.fetchLabels().then(() => {
        this.started = true;
        return [];
      });
    }

    return this.startTask;
  };

  getLabelKeys(): string[] {
    return this.labelKeys;
  }

  /**
   * Return suggestions based on input that can be then plugged into a typeahead dropdown.
   * Keep this DOM-free for testing
   * @param input
   * @param context Is optional in types but is required in case we are doing getLabelCompletionItems
   * @param context.absoluteRange Required in case we are doing getLabelCompletionItems
   * @param context.history Optional used only in getEmptyCompletionItems
   */
  async provideCompletionItems(input: TypeaheadInput, context?: TypeaheadContext): Promise<TypeaheadOutput> {
    const { wrapperClasses, value, prefix, text } = input;
    const emptyResult: TypeaheadOutput = { suggestions: [] };

    if (!value) {
      return emptyResult;
    }

    // Local text properties
    const empty = value?.document.text.length === 0;
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
    const safePrefix = prefix && !text.match(/^['"~=\]})\s]+$/) && noSuffix;

    // About to type next operand if preceded by binary operator
    const operatorsPattern = /[+\-*/^%]/;
    const isNextOperand = text.match(operatorsPattern);

    // Determine candidates by CSS context
    if (wrapperClasses.includes('context-range')) {
      // Suggestions for metric[|]
      return this.getRangeCompletionItems();
    } else if (wrapperClasses.includes('context-labels')) {
      // Suggestions for {|} and {foo=|}
      return await this.getLabelCompletionItems(input);
    } else if (wrapperClasses.includes('context-pipe')) {
      return this.getPipeCompletionItem();
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
  }

  getBeginningCompletionItems = (context?: TypeaheadContext): TypeaheadOutput => {
    return {
      suggestions: [...this.getEmptyCompletionItems(context).suggestions, ...this.getTermCompletionItems().suggestions],
    };
  };

  getEmptyCompletionItems(context?: TypeaheadContext): TypeaheadOutput {
    const history = context?.history;
    const suggestions = [];

    if (history?.length) {
      const historyItems = chain(history)
        .map((h) => h.query.expr)
        .filter()
        .uniq()
        .take(HISTORY_ITEM_COUNT)
        .map(wrapLabel)
        .map((item) => addHistoryMetadata(item, history))
        .value();

      suggestions.push({
        prefixMatch: true,
        skipSort: true,
        label: 'History',
        items: historyItems,
      });
    }

    return { suggestions };
  }

  getTermCompletionItems = (): TypeaheadOutput => {
    const suggestions = [];

    suggestions.push({
      prefixMatch: true,
      label: 'Functions',
      items: FUNCTIONS.map((suggestion) => ({ ...suggestion, kind: 'function' })),
    });

    return { suggestions };
  };

  getPipeCompletionItem = (): TypeaheadOutput => {
    const suggestions = [];

    suggestions.push({
      label: 'Operators',
      items: PIPE_OPERATORS.map((suggestion) => ({ ...suggestion, kind: 'operators' })),
    });

    suggestions.push({
      label: 'Parsers',
      items: PIPE_PARSERS.map((suggestion) => ({ ...suggestion, kind: 'parsers' })),
    });

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

  async getLabelCompletionItems({ text, wrapperClasses, labelKey, value }: TypeaheadInput): Promise<TypeaheadOutput> {
    let context = 'context-labels';
    const suggestions: CompletionItemGroup[] = [];
    if (!value) {
      return { context, suggestions: [] };
    }
    const line = value.anchorBlock.getText();
    const cursorOffset = value.selection.anchor.offset;
    const isValueStart = text.match(/^(=|=~|!=|!~)/);

    // Get normalized selector
    let selector;
    let parsedSelector;
    try {
      parsedSelector = parseSelector(line, cursorOffset);
      selector = parsedSelector.selector;
    } catch {
      selector = EMPTY_SELECTOR;
    }

    if (!labelKey && selector === EMPTY_SELECTOR) {
      // start task gets all labels
      await this.start();
      const allLabels = this.getLabelKeys();
      return { context, suggestions: [{ label: `Labels`, items: allLabels.map(wrapLabel) }] };
    }

    const existingKeys = parsedSelector ? parsedSelector.labelKeys : [];

    let labelValues;
    // Query labels for selector
    if (selector) {
      if (selector === EMPTY_SELECTOR && labelKey) {
        const labelValuesForKey = await this.getLabelValues(labelKey);
        labelValues = { [labelKey]: labelValuesForKey };
      } else {
        labelValues = await this.getSeriesLabels(selector);
      }
    }

    if (!labelValues) {
      console.warn(`Server did not return any values for selector = ${selector}`);
      return { context, suggestions };
    }

    if ((text && isValueStart) || wrapperClasses.includes('attr-value')) {
      // Label values
      if (labelKey && labelValues[labelKey]) {
        context = 'context-label-values';
        suggestions.push({
          label: `Label values for "${labelKey}"`,
          // Filter to prevent previously selected values from being repeatedly suggested
          items: labelValues[labelKey].map(wrapLabel).filter(({ filterText }) => filterText !== text),
        });
      }
    } else {
      // Label keys
      const labelKeys = labelValues ? Object.keys(labelValues) : DEFAULT_KEYS;
      if (labelKeys) {
        const possibleKeys = difference(labelKeys, existingKeys);
        if (possibleKeys.length) {
          const newItems = possibleKeys.map((key) => ({ label: key }));
          const newSuggestion: CompletionItemGroup = { label: `Labels`, items: newItems };
          suggestions.push(newSuggestion);
        }
      }
    }

    return { context, suggestions };
  }

  importFromAbstractQuery(labelBasedQuery: AbstractQuery): LokiQuery {
    return {
      refId: labelBasedQuery.refId,
      expr: toPromLikeExpr(labelBasedQuery),
      queryType: LokiQueryType.Range,
    };
  }

  exportToAbstractQuery(query: LokiQuery): AbstractQuery {
    const lokiQuery = query.expr;
    if (!lokiQuery || lokiQuery.length === 0) {
      return { refId: query.refId, labelMatchers: [] };
    }
    const tokens = Prism.tokenize(lokiQuery, syntax);
    return {
      refId: query.refId,
      labelMatchers: extractLabelMatchers(tokens),
    };
  }

  async getSeriesLabels(selector: string) {
    if (this.lookupsDisabled) {
      return undefined;
    }
    try {
      return await this.fetchSeriesLabels(selector);
    } catch (error) {
      // TODO: better error handling
      console.error(error);
      return undefined;
    }
  }

  /**
   * Fetches all label keys
   */
  async fetchLabels(): Promise<string[]> {
    const url = 'labels';
    const timeRange = this.datasource.getTimeRangeParams();
    this.labelFetchTs = Date.now().valueOf();

    const res = await this.request(url, timeRange);
    if (Array.isArray(res)) {
      const labels = res
        .slice()
        .sort()
        .filter((label) => label !== '__name__');
      this.labelKeys = labels;
      return this.labelKeys;
    }

    return [];
  }

  /**
   * Fetch labels for a selector. This is cached by its args but also by the global timeRange currently selected as
   * they can change over requested time.
   * @param name
   */
  fetchSeriesLabels = async (match: string): Promise<Record<string, string[]>> => {
    const interpolatedMatch = this.datasource.interpolateString(match);
    const url = 'series';
    const { start, end } = this.datasource.getTimeRangeParams();

    const cacheKey = this.generateCacheKey(url, start, end, interpolatedMatch);
    let value = this.seriesCache.get(cacheKey);
    if (!value) {
      const params = { 'match[]': interpolatedMatch, start, end };
      const data = await this.request(url, params);
      const { values } = processLabels(data);
      value = values;
      this.seriesCache.set(cacheKey, value);
    }
    return value;
  };

  /**
   * Fetch series for a selector. Use this for raw results. Use fetchSeriesLabels() to get labels.
   * @param match
   */
  fetchSeries = async (match: string): Promise<Array<Record<string, string>>> => {
    const url = 'series';
    const { start, end } = this.datasource.getTimeRangeParams();
    const params = { 'match[]': match, start, end };
    return await this.request(url, params);
  };

  // Cache key is a bit different here. We round up to a minute the intervals.
  // The rounding may seem strange but makes relative intervals like now-1h less prone to need separate request every
  // millisecond while still actually getting all the keys for the correct interval. This still can create problems
  // when user does not the newest values for a minute if already cached.
  generateCacheKey(url: string, start: number, end: number, param: string): string {
    return [url, this.roundTime(start), this.roundTime(end), param].join();
  }

  // Round nanos epoch to nearest 5 minute interval
  roundTime(nanos: number): number {
    return nanos ? Math.floor(nanos / NS_IN_MS / 1000 / 60 / 5) : 0;
  }

  async getLabelValues(key: string): Promise<string[]> {
    return await this.fetchLabelValues(key);
  }

  async fetchLabelValues(key: string): Promise<string[]> {
    const interpolatedKey = encodeURIComponent(this.datasource.interpolateString(key));

    const url = `label/${interpolatedKey}/values`;
    const rangeParams = this.datasource.getTimeRangeParams();
    const { start, end } = rangeParams;

    const cacheKey = this.generateCacheKey(url, start, end, interpolatedKey);
    const params = { start, end };

    let labelValues = this.labelsCache.get(cacheKey);
    if (!labelValues) {
      // Clear value when requesting new one. Empty object being truthy also makes sure we don't request twice.
      this.labelsCache.set(cacheKey, []);
      const res = await this.request(url, params);
      if (Array.isArray(res)) {
        labelValues = res.slice().sort();
        this.labelsCache.set(cacheKey, labelValues);
      }
    }

    return labelValues ?? [];
  }

  async getParserAndLabelKeys(selector: string): Promise<{
    extractedLabelKeys: string[];
    hasJSON: boolean;
    hasLogfmt: boolean;
    hasPack: boolean;
    unwrapLabelKeys: string[];
  }> {
    const series = await this.datasource.getDataSamples({ expr: selector, refId: 'data-samples' });

    if (!series.length) {
      return { extractedLabelKeys: [], unwrapLabelKeys: [], hasJSON: false, hasLogfmt: false, hasPack: false };
    }

    const { hasLogfmt, hasJSON, hasPack } = extractLogParserFromDataFrame(series[0]);

    return {
      extractedLabelKeys: extractLabelKeysFromDataFrame(series[0]),
      unwrapLabelKeys: extractUnwrapLabelKeysFromDataFrame(series[0]),
      hasJSON,
      hasPack,
      hasLogfmt,
    };
  }
}
