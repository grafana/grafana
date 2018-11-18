import _ from 'lodash';
import moment from 'moment';

import {
  CompletionItem,
  CompletionItemGroup,
  LanguageProvider,
  TypeaheadInput,
  TypeaheadOutput,
} from 'app/types/explore';
import { parseSelector, labelRegexp, selectorRegexp } from 'app/plugins/datasource/prometheus/language_utils';
import PromqlSyntax from 'app/plugins/datasource/prometheus/promql';
import { DataQuery } from 'app/types';

const DEFAULT_KEYS = ['job', 'namespace'];
const EMPTY_SELECTOR = '{}';
const HISTORY_ITEM_COUNT = 10;
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
    if (!this.startTask) {
      this.startTask = this.fetchLogLabels();
    }
    return this.startTask;
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
    let refresher: Promise<any> = null;
    const suggestions: CompletionItemGroup[] = [];
    const line = value.anchorBlock.getText();
    const cursorOffset: number = value.anchorOffset;

    // Use EMPTY_SELECTOR until series API is implemented for facetting
    const selector = EMPTY_SELECTOR;
    let parsedSelector;
    try {
      parsedSelector = parseSelector(line, cursorOffset);
    } catch {}
    const existingKeys = parsedSelector ? parsedSelector.labelKeys : [];

    if ((text && text.match(/^!?=~?/)) || _.includes(wrapperClasses, 'attr-value')) {
      // Label values
      if (labelKey && this.labelValues[selector]) {
        const labelValues = this.labelValues[selector][labelKey];
        if (labelValues) {
          context = 'context-label-values';
          suggestions.push({
            label: `Label values for "${labelKey}"`,
            items: labelValues.map(wrapLabel),
          });
        } else {
          refresher = this.fetchLabelValues(labelKey);
        }
      }
    } else {
      // Label keys
      const labelKeys = this.labelKeys[selector] || DEFAULT_KEYS;
      if (labelKeys) {
        const possibleKeys = _.difference(labelKeys, existingKeys);
        if (possibleKeys.length > 0) {
          context = 'context-labels';
          suggestions.push({ label: `Labels`, items: possibleKeys.map(wrapLabel) });
        }
      }
    }

    return { context, refresher, suggestions };
  }

  async importQueries(queries: DataQuery[], datasourceType: string): Promise<DataQuery[]> {
    if (datasourceType === 'prometheus') {
      return Promise.all(
        queries.map(async query => {
          const expr = await this.importPrometheusQuery(query.expr);
          return {
            ...query,
            expr,
          };
        })
      );
    }
    return queries.map(query => ({
      ...query,
      expr: '',
    }));
  }

  async importPrometheusQuery(query: string): Promise<string> {
    // Consider only first selector in query
    const selectorMatch = query.match(selectorRegexp);
    if (selectorMatch) {
      const selector = selectorMatch[0];
      const labels = {};
      selector.replace(labelRegexp, (_, key, operator, value) => {
        labels[key] = { value, operator };
        return '';
      });

      // Keep only labels that exist on origin and target datasource
      await this.start(); // fetches all existing label keys
      const commonLabels = {};
      for (const key in labels) {
        const existingKeys = this.labelKeys[EMPTY_SELECTOR];
        if (existingKeys.indexOf(key) > -1) {
          // Should we check for label value equality here?
          commonLabels[key] = labels[key];
        }
      }
      const labelKeys = Object.keys(commonLabels).sort();
      const cleanSelector = labelKeys
        .map(key => `${key}${commonLabels[key].operator}${commonLabels[key].value}`)
        .join(',');

      return ['{', cleanSelector, '}'].join('');
    }

    return '';
  }

  async fetchLogLabels() {
    const url = '/api/prom/label';
    try {
      const res = await this.request(url);
      const body = await (res.data || res.json());
      const labelKeys = body.data.slice().sort();
      this.labelKeys = {
        ...this.labelKeys,
        [EMPTY_SELECTOR]: labelKeys,
      };
      this.logLabelOptions = labelKeys.map(key => ({ label: key, value: key, isLeaf: false }));

      // Pre-load values for default labels
      return labelKeys.filter(key => DEFAULT_KEYS.indexOf(key) > -1).map(key => this.fetchLabelValues(key));
    } catch (e) {
      console.error(e);
    }
    return [];
  }

  async fetchLabelValues(key: string) {
    const url = `/api/prom/label/${key}/values`;
    try {
      const res = await this.request(url);
      const body = await (res.data || res.json());
      const values = body.data.slice().sort();

      // Add to label options
      this.logLabelOptions = this.logLabelOptions.map(keyOption => {
        if (keyOption.value === key) {
          return {
            ...keyOption,
            children: values.map(value => ({ label: value, value })),
          };
        }
        return keyOption;
      });

      // Add to key map
      const exisingValues = this.labelValues[EMPTY_SELECTOR];
      const nextValues = {
        ...exisingValues,
        [key]: values,
      };
      this.labelValues = {
        ...this.labelValues,
        [EMPTY_SELECTOR]: nextValues,
      };
    } catch (e) {
      console.error(e);
    }
  }
}
