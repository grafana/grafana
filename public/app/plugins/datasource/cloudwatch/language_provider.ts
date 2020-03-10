// Libraries
import _ from 'lodash';

// Services & Utils
import syntax, { QUERY_COMMANDS } from './syntax';

// Types
import { CloudWatchQuery } from './types';
import { dateTime, AbsoluteTimeRange, LanguageProvider, HistoryItem } from '@grafana/data';

import { CloudWatchDatasource } from './datasource';
import { CompletionItem, TypeaheadInput, TypeaheadOutput } from '@grafana/ui';
import { Grammar } from 'prismjs';

const HISTORY_ITEM_COUNT = 10;
const HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h
const NS_IN_MS = 1000000;
export const LABEL_REFRESH_INTERVAL = 1000 * 30; // 30sec

const wrapLabel = (label: string) => ({ label });
export const rangeToParams = (range: AbsoluteTimeRange) => ({ start: range.from * NS_IN_MS, end: range.to * NS_IN_MS });

export type CloudWatchHistoryItem = HistoryItem<CloudWatchQuery>;

type TypeaheadContext = {
  history?: CloudWatchHistoryItem[];
  absoluteRange?: AbsoluteTimeRange;
};

export function addHistoryMetadata(item: CompletionItem, history: CloudWatchHistoryItem[]): CompletionItem {
  const cutoffTs = Date.now() - HISTORY_COUNT_CUTOFF;
  const historyForItem = history.filter(h => h.ts > cutoffTs && h.query.expression === item.label);
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

export class CloudWatchLanguageProvider extends LanguageProvider {
  logLabelOptions: any[];
  logLabelFetchTs?: number;
  started: boolean;
  initialRange: AbsoluteTimeRange;
  datasource: CloudWatchDatasource;

  constructor(datasource: CloudWatchDatasource, initialValues?: any) {
    super();

    this.datasource = datasource;

    Object.assign(this, initialValues);
  }

  // Strip syntax chars
  cleanText = (s: string) => s.replace(/[{}[\]="(),!~+\-*/^%]/g, '').trim();

  getSyntax(): Grammar {
    return syntax;
  }

  request = (url: string, params?: any): Promise<{ data: { data: string[] } }> => {
    return this.datasource.awsRequest(url, params);
  };

  /**
   * Initialise the language provider by fetching set of labels. Without this initialisation the provider would return
   * just a set of hardcoded default labels on provideCompletionItems or a recent queries from history.
   */
  start = () => {
    if (!this.startTask) {
      this.startTask = Promise.resolve().then(() => {
        this.started = true;
        return [];
      });
    }

    return this.startTask;
  };

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
    const safePrefix = prefix && !text.match(/^['"~=\]})\s]+$/) && noSuffix;

    // Determine candidates by CSS context
    if (empty) {
      // Suggestions for empty query field
      return this.getEmptyCompletionItems(context);
    } else if (prefixUnrecognized && noSuffix) {
      // Show term suggestions in a couple of scenarios
      return this.getBeginningCompletionItems(context);
    } else if (prefixUnrecognized && safePrefix) {
      // Show term suggestions in a couple of scenarios
      return this.getTermCompletionItems();
    }

    return {
      suggestions: [],
    };
  }

  getBeginningCompletionItems = (context: TypeaheadContext): TypeaheadOutput => {
    return {
      suggestions: [...this.getEmptyCompletionItems(context).suggestions, ...this.getTermCompletionItems().suggestions],
    };
  };

  getEmptyCompletionItems(context: TypeaheadContext): TypeaheadOutput {
    const history = context?.history;
    const suggestions = [];

    if (history?.length) {
      const historyItems = _.chain(history)
        .map(h => h.query.expression)
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

  getTermCompletionItems = (): TypeaheadOutput => {
    const suggestions = [];

    suggestions.push({
      prefixMatch: true,
      label: 'Commands',
      items: QUERY_COMMANDS.map(command => ({ ...command, kind: 'command' })),
    });

    return { suggestions };
  };
}
