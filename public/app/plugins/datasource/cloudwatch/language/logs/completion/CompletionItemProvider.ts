import { getTemplateSrv, TemplateSrv } from '@grafana/runtime';
import { Monaco, monacoTypes } from '@grafana/ui';

import { type ResourcesAPI } from '../../../resources/ResourcesAPI';
import { LogGroup } from '../../../types';
import { CompletionItemProvider } from '../../monarch/CompletionItemProvider';
import { LinkedToken } from '../../monarch/LinkedToken';
import { TRIGGER_SUGGEST } from '../../monarch/commands';
import { CompletionItem, CompletionItemPriority, StatementPosition, SuggestionKind } from '../../monarch/types';
import { fetchLogGroupFields } from '../../utils';
import { LOGS_COMMANDS, LOGS_FUNCTION_OPERATORS, SORT_DIRECTION_KEYWORDS } from '../language';

import { getStatementPosition } from './statementPosition';
import { getSuggestionKinds } from './suggestionKinds';
import { LogsTokenTypes } from './types';

export type queryContext = {
  logGroups?: LogGroup[];
  region: string;
};

export function LogsCompletionItemProviderFunc(resources: ResourcesAPI, templateSrv: TemplateSrv = getTemplateSrv()) {
  return (queryContext: queryContext) => {
    return new LogsCompletionItemProvider(resources, templateSrv, queryContext);
  };
}

export class LogsCompletionItemProvider extends CompletionItemProvider {
  queryContext: queryContext;

  constructor(resources: ResourcesAPI, templateSrv: TemplateSrv = getTemplateSrv(), queryContext: queryContext) {
    super(resources, templateSrv);
    this.getStatementPosition = getStatementPosition;
    this.getSuggestionKinds = getSuggestionKinds;
    this.tokenTypes = LogsTokenTypes;
    this.queryContext = queryContext;
  }

  async getSuggestions(
    monaco: Monaco,
    currentToken: LinkedToken | null,
    suggestionKinds: SuggestionKind[],
    statementPosition: StatementPosition,
    position: monacoTypes.IPosition
  ): Promise<CompletionItem[]> {
    const suggestions: CompletionItem[] = [];
    const invalidRangeToken = currentToken?.isWhiteSpace() || currentToken?.isParenthesis();
    const range =
      invalidRangeToken || !currentToken?.range ? monaco.Range.fromPositions(position) : currentToken?.range;

    function toCompletionItem(value: string, rest: Partial<CompletionItem> = {}) {
      const item: monacoTypes.languages.CompletionItem = {
        label: value,
        insertText: value,
        kind: monaco.languages.CompletionItemKind.Field,
        range,
        sortText: CompletionItemPriority.Medium,
        ...rest,
      };
      return item;
    }

    function addSuggestion(value: string, rest: Partial<CompletionItem> = {}) {
      suggestions.push(toCompletionItem(value, rest));
    }

    for (const kind of suggestionKinds) {
      switch (kind) {
        case SuggestionKind.Command:
          LOGS_COMMANDS.forEach((command) => {
            addSuggestion(command, {
              insertText: `${command} $0`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              command: TRIGGER_SUGGEST,
              kind: monaco.languages.CompletionItemKind.Method,
            });
          });
          break;
        case SuggestionKind.Function:
          LOGS_FUNCTION_OPERATORS.forEach((f) => {
            addSuggestion(f, {
              insertText: `${f}($0)`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              command: TRIGGER_SUGGEST,
              kind: monaco.languages.CompletionItemKind.Function,
            });
          });

          if (this.queryContext.logGroups && this.queryContext.logGroups.length > 0) {
            let fields = await fetchLogGroupFields(
              this.queryContext.logGroups,
              this.queryContext.region,
              this.templateSrv,
              this.resources
            );
            fields.push('@log');
            fields.forEach((field) => {
              if (field !== '') {
                addSuggestion(field, {
                  range,
                  label: field,
                  insertText: field,
                  kind: monaco.languages.CompletionItemKind.Field,
                  sortText: CompletionItemPriority.High,
                });
              }
            });
          }
          break;
        case SuggestionKind.SortOrderDirectionKeyword:
          SORT_DIRECTION_KEYWORDS.forEach((direction) => {
            addSuggestion(direction, {
              sortText: CompletionItemPriority.High,
              kind: monaco.languages.CompletionItemKind.Operator,
            });
          });
          break;
        case SuggestionKind.InKeyword:
          addSuggestion('in []', {
            insertText: 'in ["$0"]',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Snippet,
            sortText: CompletionItemPriority.High,
          });
          break;
      }
    }

    this.templateSrv.getVariables().map((v) => {
      const variable = `$${v.name}`;
      addSuggestion(variable, {
        range,
        label: variable,
        insertText: variable,
        kind: monaco.languages.CompletionItemKind.Variable,
        sortText: CompletionItemPriority.Low,
      });
    });

    return suggestions;
  }
}
