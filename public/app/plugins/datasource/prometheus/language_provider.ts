import _ from 'lodash';
import moment from 'moment';

import {
  CompletionItem,
  CompletionItemGroup,
  LanguageProvider,
  TypeaheadInput,
  TypeaheadOutput,
} from 'app/types/explore';

import { parseSelector, processLabels, RATE_RANGES } from './language_utils';
import PromqlSyntax, { FUNCTIONS } from './promql';

const DEFAULT_KEYS = ['job', 'instance'];
const EMPTY_SELECTOR = '{}';
const HISTOGRAM_SELECTOR = '{le!=""}'; // Returns all timeseries for histograms
const HISTORY_ITEM_COUNT = 5;
const HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h

const wrapLabel = (label: string) => ({ label });

const setFunctionMove = (suggestion: CompletionItem): CompletionItem => {
  suggestion.move = -1;
  return suggestion;
};

export function addHistoryMetadata(item: CompletionItem, history: any[]): CompletionItem {
  const cutoffTs = Date.now() - HISTORY_COUNT_CUTOFF;
  const historyForItem = history.filter(h => h.ts > cutoffTs && h.query === item.label);
  const count = historyForItem.length;
  const recent = historyForItem[0];
  let hint = `Queried ${count} times in the last 24h.`;
  if (recent) {
    const lastQueried = moment(recent.ts).fromNow();
    hint = `${hint} Last queried ${lastQueried}.`;
  }
  return {
    ...item,
    documentation: hint,
  };
}

export default class PromQlLanguageProvider extends LanguageProvider {
  histogramMetrics?: string[];
  labelKeys?: { [index: string]: string[] }; // metric -> [labelKey,...]
  labelValues?: { [index: string]: { [index: string]: string[] } }; // metric -> labelKey -> [labelValue,...]
  metrics?: string[];
  logLabelOptions: any[];
  supportsLogs?: boolean;
  started: boolean;

  constructor(datasource: any, initialValues?: any) {
    super();

    this.datasource = datasource;
    this.histogramMetrics = [];
    this.labelKeys = {};
    this.labelValues = {};
    this.metrics = [];
    this.supportsLogs = false;
    this.started = false;

    Object.assign(this, initialValues);
  }
  // Strip syntax chars
  cleanText = s => s.replace(/[{}[\]="(),!~+\-*/^%]/g, '').trim();

  getSyntax() {
    return PromqlSyntax;
  }

  request = url => {
    return this.datasource.metadataRequest(url);
  };

  start = () => {
    if (!this.started) {
      this.started = true;
      return Promise.all([this.fetchMetricNames(), this.fetchHistogramMetrics()]);
    }
    return Promise.resolve([]);
  };

  // Keep this DOM-free for testing
  provideCompletionItems({ prefix, wrapperClasses, text }: TypeaheadInput, context?: any): TypeaheadOutput {
    // Syntax spans have 3 classes by default. More indicate a recognized token
    const tokenRecognized = wrapperClasses.length > 3;
    // Determine candidates by CSS context
    if (_.includes(wrapperClasses, 'context-range')) {
      // Suggestions for metric[|]
      return this.getRangeCompletionItems();
    } else if (_.includes(wrapperClasses, 'context-labels')) {
      // Suggestions for metric{|} and metric{foo=|}, as well as metric-independent label queries like {|}
      return this.getLabelCompletionItems.apply(this, arguments);
    } else if (_.includes(wrapperClasses, 'context-aggregation')) {
      return this.getAggregationCompletionItems.apply(this, arguments);
    } else if (
      // Show default suggestions in a couple of scenarios
      (prefix && !tokenRecognized) || // Non-empty prefix, but not inside known token
      (prefix === '' && !text.match(/^[\]})\s]+$/)) || // Empty prefix, but not following a closing brace
      text.match(/[+\-*/^%]/) // Anything after binary operator
    ) {
      return this.getEmptyCompletionItems(context || {});
    }

    return {
      suggestions: [],
    };
  }

  getEmptyCompletionItems(context: any): TypeaheadOutput {
    const { history } = context;
    const { metrics } = this;
    const suggestions: CompletionItemGroup[] = [];

    if (history && history.length > 0) {
      const historyItems = _.chain(history)
        .uniqBy('query')
        .take(HISTORY_ITEM_COUNT)
        .map(h => h.query)
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

    suggestions.push({
      prefixMatch: true,
      label: 'Functions',
      items: FUNCTIONS.map(setFunctionMove),
    });

    if (metrics) {
      suggestions.push({
        label: 'Metrics',
        items: metrics.map(wrapLabel),
      });
    }
    return { suggestions };
  }

  getRangeCompletionItems(): TypeaheadOutput {
    return {
      context: 'context-range',
      suggestions: [
        {
          label: 'Range vector',
          items: [...RATE_RANGES].map(wrapLabel),
        },
      ],
    };
  }

  getAggregationCompletionItems({ value }: TypeaheadInput): TypeaheadOutput {
    let refresher: Promise<any> = null;
    const suggestions: CompletionItemGroup[] = [];

    // sum(foo{bar="1"}) by (|)
    const line = value.anchorBlock.getText();
    const cursorOffset: number = value.anchorOffset;
    // sum(foo{bar="1"}) by (
    const leftSide = line.slice(0, cursorOffset);
    const openParensAggregationIndex = leftSide.lastIndexOf('(');
    const openParensSelectorIndex = leftSide.slice(0, openParensAggregationIndex).lastIndexOf('(');
    const closeParensSelectorIndex = leftSide.slice(openParensSelectorIndex).indexOf(')') + openParensSelectorIndex;
    // foo{bar="1"}
    const selectorString = leftSide.slice(openParensSelectorIndex + 1, closeParensSelectorIndex);
    const selector = parseSelector(selectorString, selectorString.length - 2).selector;

    const labelKeys = this.labelKeys[selector];
    if (labelKeys) {
      suggestions.push({ label: 'Labels', items: labelKeys.map(wrapLabel) });
    } else {
      refresher = this.fetchSeriesLabels(selector);
    }

    return {
      refresher,
      suggestions,
      context: 'context-aggregation',
    };
  }

  getLabelCompletionItems({ text, wrapperClasses, labelKey, value }: TypeaheadInput): TypeaheadOutput {
    let context: string;
    let refresher: Promise<any> = null;
    const suggestions: CompletionItemGroup[] = [];
    const line = value.anchorBlock.getText();
    const cursorOffset: number = value.anchorOffset;

    // Get normalized selector
    let selector;
    let parsedSelector;
    try {
      parsedSelector = parseSelector(line, cursorOffset);
      selector = parsedSelector.selector;
    } catch {
      selector = EMPTY_SELECTOR;
    }
    const containsMetric = selector.indexOf('__name__=') > -1;
    const existingKeys = parsedSelector ? parsedSelector.labelKeys : [];

    if ((text && text.match(/^!?=~?/)) || _.includes(wrapperClasses, 'attr-value')) {
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
        if (possibleKeys.length > 0) {
          context = 'context-labels';
          suggestions.push({ label: `Labels`, items: possibleKeys.map(wrapLabel) });
        }
      }
    }

    // Query labels for selector
    // Temporarily add skip for logging
    if (selector && !this.labelValues[selector] && !this.supportsLogs) {
      if (selector === EMPTY_SELECTOR) {
        // Query label values for default labels
        refresher = Promise.all(DEFAULT_KEYS.map(key => this.fetchLabelValues(key)));
      } else {
        refresher = this.fetchSeriesLabels(selector, !containsMetric);
      }
    }

    return { context, refresher, suggestions };
  }

  async fetchMetricNames() {
    const url = '/api/v1/label/__name__/values';
    try {
      const res = await this.request(url);
      const body = await (res.data || res.json());
      this.metrics = body.data;
    } catch (error) {
      console.error(error);
    }
  }

  async fetchHistogramMetrics() {
    await this.fetchSeriesLabels(HISTOGRAM_SELECTOR, true);
    const histogramSeries = this.labelValues[HISTOGRAM_SELECTOR];
    if (histogramSeries && histogramSeries['__name__']) {
      this.histogramMetrics = histogramSeries['__name__'].slice().sort();
    }
  }

  // Temporarily here while reusing this field for logging
  async fetchLogLabels() {
    const url = '/api/prom/label';
    try {
      const res = await this.request(url);
      const body = await (res.data || res.json());
      const labelKeys = body.data.slice().sort();
      const labelKeysBySelector = {
        ...this.labelKeys,
        [EMPTY_SELECTOR]: labelKeys,
      };
      const labelValuesByKey = {};
      this.logLabelOptions = [];
      for (const key of labelKeys) {
        const valuesUrl = `/api/prom/label/${key}/values`;
        const res = await this.request(valuesUrl);
        const body = await (res.data || res.json());
        const values = body.data.slice().sort();
        labelValuesByKey[key] = values;
        this.logLabelOptions.push({
          label: key,
          value: key,
          children: values.map(value => ({ label: value, value })),
        });
      }
      this.labelValues = { [EMPTY_SELECTOR]: labelValuesByKey };
      this.labelKeys = labelKeysBySelector;
    } catch (e) {
      console.error(e);
    }
  }

  async fetchLabelValues(key: string) {
    const url = `/api/v1/label/${key}/values`;
    try {
      const res = await this.request(url);
      const body = await (res.data || res.json());
      const exisingValues = this.labelValues[EMPTY_SELECTOR];
      const values = {
        ...exisingValues,
        [key]: body.data,
      };
      this.labelValues = {
        ...this.labelValues,
        [EMPTY_SELECTOR]: values,
      };
    } catch (e) {
      console.error(e);
    }
  }

  async fetchSeriesLabels(name: string, withName?: boolean) {
    const url = `/api/v1/series?match[]=${name}`;
    try {
      const res = await this.request(url);
      const body = await (res.data || res.json());
      const { keys, values } = processLabels(body.data, withName);
      this.labelKeys = {
        ...this.labelKeys,
        [name]: keys,
      };
      this.labelValues = {
        ...this.labelValues,
        [name]: values,
      };
    } catch (e) {
      console.error(e);
    }
  }
}
