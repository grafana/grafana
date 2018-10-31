import _ from 'lodash';
import moment from 'moment';

import {
  CompletionItem,
  CompletionItemGroup,
  LanguageProvider,
  TypeaheadInput,
  TypeaheadOutput,
} from 'app/types/explore';

import { parseSelector } from 'app/plugins/datasource/prometheus/language_utils';
import PromqlSyntax from 'app/plugins/datasource/prometheus/promql';

const DEFAULT_KEYS = ['job', 'instance'];
const EMPTY_SELECTOR = '{}';
const HISTORY_ITEM_COUNT = 5;
const HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h

const wrapLabel = (label: string) => ({ label });

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

export default class LoggingLanguageProvider extends LanguageProvider {
  labelKeys?: { [index: string]: string[] }; // metric -> [labelKey,...]
  labelValues?: { [index: string]: { [index: string]: string[] } }; // metric -> labelKey -> [labelValue,...]
  logLabelOptions: any[];
  started: boolean;

  constructor(datasource: any, initialValues?: any) {
    super();

    this.datasource = datasource;
    this.labelKeys = {};
    this.labelValues = {};
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
      return Promise.all([this.fetchLogLabels()]);
    }
    return Promise.resolve([]);
  };

  // Keep this DOM-free for testing
  provideCompletionItems({ prefix, wrapperClasses, text }: TypeaheadInput, context?: any): TypeaheadOutput {
    // Syntax spans have 3 classes by default. More indicate a recognized token
    const tokenRecognized = wrapperClasses.length > 3;
    // Determine candidates by CSS context
    if (_.includes(wrapperClasses, 'context-labels')) {
      // Suggestions for metric{|} and metric{foo=|}, as well as metric-independent label queries like {|}
      return this.getLabelCompletionItems.apply(this, arguments);
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

    return { suggestions };
  }

  getLabelCompletionItems({ text, wrapperClasses, labelKey, value }: TypeaheadInput): TypeaheadOutput {
    let context: string;
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

    return { context, suggestions };
  }

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
    const url = `/api/prom/label/${key}/values`;
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
}
