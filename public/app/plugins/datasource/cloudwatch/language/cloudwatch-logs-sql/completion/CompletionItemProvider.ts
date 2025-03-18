import { getTemplateSrv, TemplateSrv } from '@grafana/runtime';
import type { Monaco, monacoTypes } from '@grafana/ui';

import { ResourcesAPI } from '../../../resources/ResourcesAPI';
import { LogGroup } from '../../../types';
import { CompletionItemProvider } from '../../monarch/CompletionItemProvider';
import { LinkedToken } from '../../monarch/LinkedToken';
import { TRIGGER_SUGGEST } from '../../monarch/commands';
import { SuggestionKind, CompletionItemPriority, StatementPosition } from '../../monarch/types';
import { fetchLogGroupFields } from '../../utils';
import {
  ASC,
  BY,
  PREDICATE_OPERATORS,
  DESC,
  FROM,
  ALL_FUNCTIONS,
  ALL,
  DISTINCT,
  GROUP,
  LIMIT,
  INNER,
  LEFT,
  OUTER,
  ON,
  JOIN,
  LOGICAL_OPERATORS,
  ORDER,
  SELECT,
  WHERE,
  HAVING,
  CASE,
  WHEN,
  THEN,
  ELSE,
  END,
} from '../language';

import { getStatementPosition } from './statementPosition';
import { getSuggestionKinds } from './suggestionKind';
import { SQLTokenTypes } from './types';

type CompletionItem = monacoTypes.languages.CompletionItem;

export type queryContext = {
  logGroups?: LogGroup[];
  region: string;
};

export function LogsSQLCompletionItemProviderFunc(
  resources: ResourcesAPI,
  templateSrv: TemplateSrv = getTemplateSrv()
) {
  return (queryContext: queryContext) => {
    return new LogsSQLCompletionItemProvider(resources, templateSrv, queryContext);
  };
}

export class LogsSQLCompletionItemProvider extends CompletionItemProvider {
  region: string;
  queryContext: queryContext;

  constructor(resources: ResourcesAPI, templateSrv: TemplateSrv = getTemplateSrv(), queryContext: queryContext) {
    super(resources, templateSrv);
    this.region = resources.getActualRegion() ?? '';
    this.getStatementPosition = getStatementPosition;
    this.getSuggestionKinds = getSuggestionKinds;
    this.tokenTypes = SQLTokenTypes;
    this.queryContext = queryContext;
  }

  async getSuggestions(
    monaco: Monaco,
    currentToken: LinkedToken | null,
    suggestionKinds: SuggestionKind[],
    statementPosition: StatementPosition,
    position: monacoTypes.IPosition
  ): Promise<CompletionItem[]> {
    let suggestions: CompletionItem[] = [];
    const invalidRangeToken = currentToken?.isWhiteSpace() || currentToken?.isParenthesis();
    const range =
      invalidRangeToken || !currentToken?.range ? monaco.Range.fromPositions(position) : currentToken?.range;

    const toCompletionItem = (value: string, rest: Partial<CompletionItem> = {}) => {
      const item: CompletionItem = {
        label: value,
        insertText: value,
        kind: monaco.languages.CompletionItemKind.Field,
        range,
        sortText: CompletionItemPriority.Medium,
        ...rest,
      };
      return item;
    };

    function addSuggestion(value: string, rest: Partial<CompletionItem> = {}) {
      suggestions = [...suggestions, toCompletionItem(value, rest)];
    }

    for (const suggestion of suggestionKinds) {
      switch (suggestion) {
        case SuggestionKind.SelectKeyword:
          addSuggestion(SELECT, {
            insertText: `${SELECT} $0`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Keyword,
            command: TRIGGER_SUGGEST,
          });
          break;

        case SuggestionKind.AfterSelectKeyword:
          addSuggestion(ALL, {
            insertText: `${ALL} `,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            command: TRIGGER_SUGGEST,
            kind: monaco.languages.CompletionItemKind.Keyword,
          });
          addSuggestion(DISTINCT, {
            insertText: `${DISTINCT} `,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            command: TRIGGER_SUGGEST,
            kind: monaco.languages.CompletionItemKind.Keyword,
          });
          break;

        case SuggestionKind.FunctionsWithArguments:
          ALL_FUNCTIONS.map((s) =>
            addSuggestion(s, {
              insertText: `${s}($0)`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              command: TRIGGER_SUGGEST,
              kind: monaco.languages.CompletionItemKind.Function,
            })
          );
          break;

        case SuggestionKind.FromKeyword:
          addSuggestion(FROM, {
            insertText: `${FROM} $0`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Keyword,
            command: TRIGGER_SUGGEST,
            sortText: CompletionItemPriority.MediumHigh,
          });
          addSuggestion(`${FROM} \`logGroups(logGroupIdentifier: [...])\``, {
            insertText: `${FROM} \`logGroups(logGroupIdentifier: [$0])\``,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Keyword,
            command: TRIGGER_SUGGEST,
            sortText: CompletionItemPriority.MediumHigh,
          });
          break;

        case SuggestionKind.AfterFromKeyword:
          addSuggestion('`logGroups(logGroupIdentifier: [...])`', {
            insertText: '`logGroups(logGroupIdentifier: [$0])`',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Function,
            command: TRIGGER_SUGGEST,
          });
          break;

        case SuggestionKind.LogicalOperators:
          LOGICAL_OPERATORS.map((o) =>
            addSuggestion(`${o}`, {
              insertText: `${o} `,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.MediumHigh,
            })
          );
          break;

        case SuggestionKind.WhereKeyword:
          addSuggestion(`${WHERE}`, {
            insertText: `${WHERE} `,
            command: TRIGGER_SUGGEST,
            sortText: CompletionItemPriority.High,
          });
          break;

        case SuggestionKind.HavingKeywords:
          addSuggestion(`${HAVING}`, {
            insertText: `${HAVING} `,
            command: TRIGGER_SUGGEST,
          });
          break;

        case SuggestionKind.ComparisonOperators:
          PREDICATE_OPERATORS.map((o) => addSuggestion(`${o}`, { insertText: `${o} `, command: TRIGGER_SUGGEST }));
          break;

        case SuggestionKind.CaseKeyword:
          addSuggestion(CASE, {
            insertText: `${CASE} `,
            kind: monaco.languages.CompletionItemKind.Keyword,
            command: TRIGGER_SUGGEST,
          });
          break;

        case SuggestionKind.WhenKeyword:
          addSuggestion(WHEN, {
            insertText: `${WHEN} `,
            kind: monaco.languages.CompletionItemKind.Keyword,
            command: TRIGGER_SUGGEST,
          });
          break;

        case SuggestionKind.ThenKeyword:
          addSuggestion(THEN, {
            insertText: `${THEN} `,
            kind: monaco.languages.CompletionItemKind.Keyword,
            command: TRIGGER_SUGGEST,
          });
          break;

        case SuggestionKind.AfterThenExpression:
          addSuggestion(`${ELSE} ... ${END}`, {
            insertText: `${ELSE} $0 ${END}`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Keyword,
            command: TRIGGER_SUGGEST,
          });
          break;

        case SuggestionKind.GroupByKeywords:
          addSuggestion(`${GROUP} ${BY}`, {
            insertText: `${GROUP} ${BY} `,
            command: TRIGGER_SUGGEST,
            sortText: CompletionItemPriority.MediumHigh,
          });
          break;

        case SuggestionKind.OrderByKeywords:
          addSuggestion(`${ORDER} ${BY}`, {
            insertText: `${ORDER} ${BY} `,
            command: TRIGGER_SUGGEST,
            sortText: CompletionItemPriority.Medium,
          });
          break;

        case SuggestionKind.JoinKeywords:
          addSuggestion(`${INNER} ${JOIN} <log group> ${ON} <field>`, {
            insertText: `${INNER} ${JOIN} $1 ${ON} $2`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Keyword,
            command: TRIGGER_SUGGEST,
            sortText: CompletionItemPriority.MediumLow,
          });
          addSuggestion(`${LEFT} ${OUTER} ${JOIN} <log group> ${ON} <field>`, {
            insertText: `${LEFT} ${OUTER} ${JOIN} $1 ${ON} $2`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Keyword,
            command: TRIGGER_SUGGEST,
            sortText: CompletionItemPriority.MediumLow,
          });
          break;

        case SuggestionKind.LimitKeyword:
          addSuggestion(LIMIT, { insertText: `${LIMIT} ` });
          break;

        case SuggestionKind.SortOrderDirectionKeyword:
          [ASC, DESC].map((s) =>
            addSuggestion(s, {
              insertText: `${s} `,
              command: TRIGGER_SUGGEST,
            })
          );
          break;

        case SuggestionKind.Field:
          const fields = await fetchLogGroupFields(
            this.queryContext.logGroups || [],
            this.queryContext.region,
            this.templateSrv,
            this.resources
          );
          fields.forEach((field) => {
            if (field !== '') {
              addSuggestion(field, {
                label: field,
                insertText: `\`${field}\``,
                kind: monaco.languages.CompletionItemKind.Field,
              });
            }
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
