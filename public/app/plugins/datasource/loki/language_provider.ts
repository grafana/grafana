// Libraries
import _ from 'lodash';

// Services & Utils
import { parseSelector, labelRegexp, selectorRegexp } from 'app/plugins/datasource/prometheus/language_utils';
import syntax from './syntax';

// Types
import { LokiQuery } from './types';
import { dateTime, AbsoluteTimeRange, LanguageProvider, HistoryItem } from '@grafana/data';
import { PromQuery } from '../prometheus/types';

import LokiDatasource from './datasource';
import { CompletionItem, TypeaheadInput, TypeaheadOutput } from '@grafana/ui';

const DEFAULT_KEYS = ['job', 'namespace'];
const EMPTY_SELECTOR = '{}';
const HISTORY_ITEM_COUNT = 10;
const HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h
const NS_IN_MS = 1000000;
export const LABEL_REFRESH_INTERVAL = 1000 * 30; // 30sec

const wrapLabel = (label: string) => ({ label });
export const rangeToParams = (range: AbsoluteTimeRange) => ({ start: range.from * NS_IN_MS, end: range.to * NS_IN_MS });

export type LokiHistoryItem = HistoryItem<LokiQuery>;

type TypeaheadContext = {
  history?: LokiHistoryItem[];
  absoluteRange?: AbsoluteTimeRange;
};

export function addHistoryMetadata(item: CompletionItem, history: LokiHistoryItem[]): CompletionItem {
  const cutoffTs = Date.now() - HISTORY_COUNT_CUTOFF;
  const historyForItem = history.filter(h => h.ts > cutoffTs && (h.query.expr as string) === item.label);
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

export default class LokiLanguageProvider extends LanguageProvider {
  labelKeys?: { [index: string]: string[] }; // metric -> [labelKey,...]
  labelValues?: { [index: string]: { [index: string]: string[] } }; // metric -> labelKey -> [labelValue,...]
  logLabelOptions: any[];
  logLabelFetchTs?: number;
  started: boolean;
  initialRange: AbsoluteTimeRange;
  datasource: LokiDatasource;

  constructor(datasource: LokiDatasource, initialValues?: any) {
    super();

    this.datasource = datasource;
    this.labelKeys = {};
    this.labelValues = {};

    Object.assign(this, initialValues);
  }

  // Strip syntax chars
  cleanText = (s: string) => s.replace(/[{}[\]="(),!~+\-*/^%]/g, '').trim();

  getSyntax() {
    return syntax;
  }

  request = (url: string, params?: any) => {
    return this.datasource.metadataRequest(url, params);
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
    return this.labelKeys[EMPTY_SELECTOR];
  }

  async getLabelValues(key: string): Promise<string[]> {
    await this.fetchLabelValues(key, this.initialRange);
    return this.labelValues[EMPTY_SELECTOR][key];
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
    const { wrapperClasses, value } = input;
    // Local text properties
    const empty = value.document.text.length === 0;
    // Determine candidates by CSS context
    if (_.includes(wrapperClasses, 'context-labels')) {
      // Suggestions for {|} and {foo=|}
      return await this.getLabelCompletionItems(input, context);
    } else if (empty) {
      return this.getEmptyCompletionItems(context || {});
    }

    return {
      suggestions: [],
    };
  }

  getEmptyCompletionItems(context: any): TypeaheadOutput {
    const { history } = context;
    const suggestions = [];

    if (history && history.length > 0) {
      const historyItems = _.chain(history)
        .map((h: any) => h.query.expr)
        .filter()
        .uniq()
        .take(HISTORY_ITEM_COUNT)
        .map(wrapLabel)
        .map((item: CompletionItem) => addHistoryMetadata(item, history))
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

  async getLabelCompletionItems(
    { text, wrapperClasses, labelKey, value }: TypeaheadInput,
    { absoluteRange }: any
  ): Promise<TypeaheadOutput> {
    let context: string;
    const suggestions = [];
    const line = value.anchorBlock.getText();
    const cursorOffset: number = value.selection.anchor.offset;

    // Use EMPTY_SELECTOR until series API is implemented for facetting
    const selector = EMPTY_SELECTOR;
    let parsedSelector;
    try {
      parsedSelector = parseSelector(line, cursorOffset);
    } catch {}
    const existingKeys = parsedSelector ? parsedSelector.labelKeys : [];

    if ((text && text.match(/^!?=~?/)) || wrapperClasses.includes('attr-value')) {
      // Label values
      if (labelKey && this.labelValues[selector]) {
        let labelValues = this.labelValues[selector][labelKey];
        if (!labelValues) {
          await this.fetchLabelValues(labelKey, absoluteRange);
          labelValues = this.labelValues[selector][labelKey];
        }

        context = 'context-label-values';
        suggestions.push({
          label: `Label values for "${labelKey}"`,
          items: labelValues.map(wrapLabel),
        });
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

    return { context, suggestions };
  }

  async importQueries(queries: LokiQuery[], datasourceType: string): Promise<LokiQuery[]> {
    if (datasourceType === 'prometheus') {
      return Promise.all(
        queries.map(async query => {
          const expr = await this.importPrometheusQuery(query.expr);
          const { context, ...rest } = query as PromQuery;
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
    if (selectorMatch) {
      const selector = selectorMatch[0];
      const labels: { [key: string]: { value: any; operator: any } } = {};
      selector.replace(labelRegexp, (_, key, operator, value) => {
        labels[key] = { value, operator };
        return '';
      });

      // Keep only labels that exist on origin and target datasource
      await this.start(); // fetches all existing label keys
      const existingKeys = this.labelKeys[EMPTY_SELECTOR];
      let labelsToKeep: { [key: string]: { value: any; operator: any } } = {};
      if (existingKeys && existingKeys.length > 0) {
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

    return '';
  }

  async fetchLogLabels(absoluteRange: AbsoluteTimeRange): Promise<any> {
    const url = '/api/prom/label';
    try {
      this.logLabelFetchTs = Date.now();

      const res = await this.request(url, rangeToParams(absoluteRange));
      const body = await (res.data || res.json());
      const labelKeys = body.data.slice().sort();
      this.labelKeys = {
        ...this.labelKeys,
        [EMPTY_SELECTOR]: labelKeys,
      };
      this.labelValues = {
        [EMPTY_SELECTOR]: {},
      };
      this.logLabelOptions = labelKeys.map((key: string) => ({ label: key, value: key, isLeaf: false }));
    } catch (e) {
      console.error(e);
    }
    return [];
  }

  async refreshLogLabels(absoluteRange: AbsoluteTimeRange, forceRefresh?: boolean) {
    if ((this.labelKeys && Date.now() - this.logLabelFetchTs > LABEL_REFRESH_INTERVAL) || forceRefresh) {
      await this.fetchLogLabels(absoluteRange);
    }
  }

  async fetchLabelValues(key: string, absoluteRange: AbsoluteTimeRange) {
    const url = `/api/prom/label/${key}/values`;
    try {
      const res = await this.request(url, rangeToParams(absoluteRange));
      const body = await (res.data || res.json());
      const values = body.data.slice().sort();

      // Add to label options
      this.logLabelOptions = this.logLabelOptions.map(keyOption => {
        if (keyOption.value === key) {
          return {
            ...keyOption,
            children: values.map((value: string) => ({ label: value, value })),
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
