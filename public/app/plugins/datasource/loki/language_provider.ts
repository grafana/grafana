// Libraries
import _ from 'lodash';
import LRU from 'lru-cache';

// Services & Utils
import {
  parseSelector,
  labelRegexp,
  selectorRegexp,
  processLabels,
} from 'app/plugins/datasource/prometheus/language_utils';
import syntax, { FUNCTIONS } from './syntax';

// Types
import { LokiQuery } from './types';
import { dateTime, AbsoluteTimeRange, LanguageProvider, HistoryItem } from '@grafana/data';
import { PromQuery } from '../prometheus/types';
import { RATE_RANGES } from '../prometheus/promql';

import LokiDatasource from './datasource';
import { CompletionItem, TypeaheadInput, TypeaheadOutput, CompletionItemGroup } from '@grafana/ui';
import { Grammar } from 'prismjs';

const DEFAULT_KEYS = ['job', 'namespace'];
const EMPTY_SELECTOR = '{}';
const HISTORY_ITEM_COUNT = 10;
const HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h
const NS_IN_MS = 1000000;
export const LABEL_REFRESH_INTERVAL = 1000 * 30; // 30sec

const wrapLabel = (label: string) => ({ label, filterText: `\"${label}\"` });

export const rangeToParams = (range: AbsoluteTimeRange) => ({ start: range.from * NS_IN_MS, end: range.to * NS_IN_MS });

export type LokiHistoryItem = HistoryItem<LokiQuery>;

type TypeaheadContext = {
  history?: LokiHistoryItem[];
  absoluteRange?: AbsoluteTimeRange;
};

export function addHistoryMetadata(item: CompletionItem, history: LokiHistoryItem[]): CompletionItem {
  const cutoffTs = Date.now() - HISTORY_COUNT_CUTOFF;
  const historyForItem = history.filter(h => h.ts > cutoffTs && h.query.expr === item.label);
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
  logLabelOptions: any[];
  logLabelFetchTs: number;
  started: boolean;
  initialRange: AbsoluteTimeRange;
  datasource: LokiDatasource;
  lookupsDisabled: boolean; // Dynamically set to true for big/slow instances

  /**
   *  Cache for labels of series. This is bit simplistic in the sense that it just counts responses each as a 1 and does
   *  not account for different size of a response. If that is needed a `length` function can be added in the options.
   *  10 as a max size is totally arbitrary right now.
   */
  private seriesCache = new LRU<string, Record<string, string[]>>(10);
  private labelsCache = new LRU<string, string[]>(10);

  constructor(datasource: LokiDatasource, initialValues?: any) {
    super();

    this.datasource = datasource;
    this.labelKeys = [];
    this.logLabelFetchTs = 0;

    Object.assign(this, initialValues);
  }

  // Strip syntax chars
  cleanText = (s: string) => s.replace(/[{}[\]="(),!~+\-*/^%]/g, '').trim();

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
      this.startTask = this.fetchLogLabels(this.initialRange).then(() => {
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
      return await this.getLabelCompletionItems(input, context);
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
  }

  getTermCompletionItems = (): TypeaheadOutput => {
    const suggestions = [];

    suggestions.push({
      prefixMatch: true,
      label: 'Functions',
      items: FUNCTIONS.map(suggestion => ({ ...suggestion, kind: 'function' })),
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

  async getLabelCompletionItems(
    { text, wrapperClasses, labelKey, value }: TypeaheadInput,
    { absoluteRange }: any
  ): Promise<TypeaheadOutput> {
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

    if (!isValueStart && selector === EMPTY_SELECTOR) {
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
        const labelValuesForKey = await this.getLabelValues(labelKey, absoluteRange);
        labelValues = { [labelKey]: labelValuesForKey };
      } else {
        labelValues = await this.getSeriesLabels(selector, absoluteRange);
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
        const possibleKeys = _.difference(labelKeys, existingKeys);
        if (possibleKeys.length) {
          const newItems = possibleKeys.map(key => ({ label: key }));
          const newSuggestion: CompletionItemGroup = { label: `Labels`, items: newItems };
          suggestions.push(newSuggestion);
        }
      }
    }

    return { context, suggestions };
  }

  async importQueries(queries: LokiQuery[], datasourceType: string): Promise<LokiQuery[]> {
    if (datasourceType === 'prometheus') {
      return Promise.all(
        queries.map(async query => {
          const expr = await this.importPrometheusQuery(query.expr);
          const { ...rest } = query as PromQuery;
          return {
            ...rest,
            expr,
          };
        })
      );
    }
    // Return a cleaned LokiQuery
    return queries.map(query => ({
      refId: query.refId,
      expr: '',
    }));
  }

  async importPrometheusQuery(query: string): Promise<string> {
    if (!query) {
      return '';
    }

    // Consider only first selector in query
    const selectorMatch = query.match(selectorRegexp);
    if (!selectorMatch) {
      return '';
    }

    const selector = selectorMatch[0];
    const labels: { [key: string]: { value: any; operator: any } } = {};
    selector.replace(labelRegexp, (_, key, operator, value) => {
      labels[key] = { value, operator };
      return '';
    });

    // Keep only labels that exist on origin and target datasource
    await this.start(); // fetches all existing label keys
    const existingKeys = this.labelKeys;
    let labelsToKeep: { [key: string]: { value: any; operator: any } } = {};
    if (existingKeys && existingKeys.length) {
      // Check for common labels
      for (const key in labels) {
        if (existingKeys && existingKeys.includes(key)) {
          // Should we check for label value equality here?
          labelsToKeep[key] = labels[key];
        }
      }
    } else {
      // Keep all labels by default
      labelsToKeep = labels;
    }

    const labelKeys = Object.keys(labelsToKeep).sort();
    const cleanSelector = labelKeys
      .map(key => `${key}${labelsToKeep[key].operator}${labelsToKeep[key].value}`)
      .join(',');

    return ['{', cleanSelector, '}'].join('');
  }

  async getSeriesLabels(selector: string, absoluteRange: AbsoluteTimeRange) {
    if (this.lookupsDisabled) {
      return undefined;
    }
    try {
      return await this.fetchSeriesLabels(selector, absoluteRange);
    } catch (error) {
      // TODO: better error handling
      console.error(error);
      return undefined;
    }
  }

  /**
   * Fetches all label keys
   * @param absoluteRange Fetches
   */
  async fetchLogLabels(absoluteRange: AbsoluteTimeRange): Promise<any> {
    const url = '/loki/api/v1/label';
    try {
      this.logLabelFetchTs = Date.now().valueOf();
      const rangeParams = absoluteRange ? rangeToParams(absoluteRange) : {};
      const res = await this.request(url, rangeParams);
      this.labelKeys = res.slice().sort();
      this.logLabelOptions = this.labelKeys.map((key: string) => ({ label: key, value: key, isLeaf: false }));
    } catch (e) {
      console.error(e);
    }
    return [];
  }

  async refreshLogLabels(absoluteRange: AbsoluteTimeRange, forceRefresh?: boolean) {
    if ((this.labelKeys && Date.now().valueOf() - this.logLabelFetchTs > LABEL_REFRESH_INTERVAL) || forceRefresh) {
      await this.fetchLogLabels(absoluteRange);
    }
  }

  /**
   * Fetch labels for a selector. This is cached by it's args but also by the global timeRange currently selected as
   * they can change over requested time.
   * @param name
   */
  fetchSeriesLabels = async (match: string, absoluteRange: AbsoluteTimeRange): Promise<Record<string, string[]>> => {
    const rangeParams = absoluteRange ? rangeToParams(absoluteRange) : { start: 0, end: 0 };
    const url = '/loki/api/v1/series';
    const { start, end } = rangeParams;

    const cacheKey = this.generateCacheKey(url, start, end, match);
    const params = { match, start, end };
    let value = this.seriesCache.get(cacheKey);
    if (!value) {
      // Clear value when requesting new one. Empty object being truthy also makes sure we don't request twice.
      this.seriesCache.set(cacheKey, {});
      const data = await this.request(url, params);
      const { values } = processLabels(data);
      value = values;
      this.seriesCache.set(cacheKey, value);
    }
    return value;
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

  async getLabelValues(key: string, absoluteRange = this.initialRange): Promise<string[]> {
    return await this.fetchLabelValues(key, absoluteRange);
  }

  async fetchLabelValues(key: string, absoluteRange: AbsoluteTimeRange): Promise<string[]> {
    const url = `/loki/api/v1/label/${key}/values`;
    let values: string[] = [];
    const rangeParams = absoluteRange ? rangeToParams(absoluteRange) : { start: 0, end: 0 };
    const { start, end } = rangeParams;

    const cacheKey = this.generateCacheKey(url, start, end, key);
    const params = { start, end };

    let value = this.labelsCache.get(cacheKey);
    if (!value) {
      try {
        // Clear value when requesting new one. Empty object being truthy also makes sure we don't request twice.
        this.labelsCache.set(cacheKey, []);
        const res = await this.request(url, params);
        values = res.slice().sort();
        value = values;
        this.labelsCache.set(cacheKey, value);

        this.logLabelOptions = this.addLabelValuesToOptions(key, values);
      } catch (e) {
        console.error(e);
      }
    } else {
      this.logLabelOptions = this.addLabelValuesToOptions(key, value);
    }
    return value ?? [];
  }

  private addLabelValuesToOptions = (labelKey: string, values: string[]) => {
    return this.logLabelOptions.map(keyOption =>
      keyOption.value === labelKey
        ? {
            ...keyOption,
            children: values.map(value => ({ label: value, value })),
          }
        : keyOption
    );
  };
}
