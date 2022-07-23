import { Registry } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import {
  CompletionItemInsertTextRule,
  CompletionItemKind,
  CompletionItemPriority,
  MacroType,
  OperatorType,
  SuggestionKind,
} from '../types';
import { TRIGGER_SUGGEST } from '../utils/commands';

import { ASC, DESC, LOGICAL_OPERATORS, STD_OPERATORS, STD_STATS } from './language';
import { MACROS } from './macros';
import { FunctionsRegistryItem, MacrosRegistryItem, OperatorsRegistryItem, SuggestionsRegistryItem } from './types';

/**
 * This registry glues particular SuggestionKind with an async function that provides completion items for it.
 * To add a new suggestion kind, SQLEditor should be configured with a provider that implements customSuggestionKinds.
 */

export const initStandardSuggestions =
  (
    functions: Registry<FunctionsRegistryItem>,
    operators: Registry<OperatorsRegistryItem>,
    macros: Registry<MacrosRegistryItem>
  ) =>
  (): SuggestionsRegistryItem[] =>
    [
      {
        id: SuggestionKind.SelectKeyword,
        name: SuggestionKind.SelectKeyword,
        suggestions: (_, m) =>
          Promise.resolve([
            {
              label: `SELECT <column>`,
              insertText: `SELECT $0`,
              insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
              kind: CompletionItemKind.Snippet,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.Medium,
            },
            {
              label: `SELECT <column> FROM <table>`,
              insertText: `SELECT $2 FROM $1`,
              insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
              kind: CompletionItemKind.Snippet,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.Medium,
            },
          ]),
      },
      {
        id: SuggestionKind.TemplateVariables,
        name: SuggestionKind.TemplateVariables,
        suggestions: (_, m) => {
          const templateSrv = getTemplateSrv();
          if (!templateSrv) {
            return Promise.resolve([]);
          }

          return Promise.resolve(
            templateSrv.getVariables().map((variable) => {
              const label = `\$${variable.name}`;
              const val = templateSrv.replace(label);
              return {
                label,
                detail: `(Template Variable) ${val}`,
                kind: CompletionItemKind.Snippet,
                documentation: `(Template Variable) ${val}`,
                insertText: `\\$${variable.name} `,
                insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
                command: TRIGGER_SUGGEST,
              };
            })
          );
        },
      },
      {
        id: SuggestionKind.SelectMacro,
        name: SuggestionKind.SelectMacro,
        suggestions: (_, m) =>
          Promise.resolve([
            ...macros
              .list()
              .filter((m) => m.type === MacroType.Value || m.type === MacroType.Column)
              .map(createMacroSuggestionItem),
          ]),
      },
      {
        id: SuggestionKind.TableMacro,
        name: SuggestionKind.TableMacro,
        suggestions: (_, m) =>
          Promise.resolve([
            ...macros
              .list()
              .filter((m) => m.type === MacroType.Table)
              .map(createMacroSuggestionItem),
          ]),
      },
      {
        id: SuggestionKind.GroupMacro,
        name: SuggestionKind.GroupMacro,
        suggestions: (_, m) =>
          Promise.resolve([
            ...macros
              .list()
              .filter((m) => m.type === MacroType.Group)
              .map(createMacroSuggestionItem),
          ]),
      },
      {
        id: SuggestionKind.FilterMacro,
        name: SuggestionKind.FilterMacro,
        suggestions: (_, m) =>
          Promise.resolve([
            ...macros
              .list()
              .filter((m) => m.type === MacroType.Filter)
              .map(createMacroSuggestionItem),
          ]),
      },
      {
        id: SuggestionKind.WithKeyword,
        name: SuggestionKind.WithKeyword,
        suggestions: (_, m) =>
          Promise.resolve([
            {
              label: `WITH <alias> AS ( ... )`,
              insertText: `WITH $1  AS ( $2 )`,
              insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
              kind: CompletionItemKind.Snippet,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.Medium,
            },
          ]),
      },
      {
        id: SuggestionKind.FunctionsWithArguments,
        name: SuggestionKind.FunctionsWithArguments,
        suggestions: (_, m) =>
          Promise.resolve([
            ...functions.list().map((f) => ({
              label: f.name,
              insertText: `${f.name}($0)`,
              documentation: f.description,
              insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
              kind: CompletionItemKind.Function,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.MediumHigh,
            })),
          ]),
      },
      {
        id: SuggestionKind.FunctionsWithoutArguments,
        name: SuggestionKind.FunctionsWithoutArguments,
        suggestions: (_, m) =>
          Promise.resolve([
            ...functions.list().map((f) => ({
              label: f.name,
              insertText: `${f.name}()`,
              documentation: f.description,
              insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
              kind: CompletionItemKind.Function,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.MediumHigh,
            })),
          ]),
      },
      {
        id: SuggestionKind.FromKeyword,
        name: SuggestionKind.FromKeyword,
        suggestions: (_, m) =>
          Promise.resolve([
            {
              label: 'FROM',
              insertText: `FROM $0`,
              command: TRIGGER_SUGGEST,
              insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
              kind: CompletionItemKind.Keyword,
            },
          ]),
      },
      {
        id: SuggestionKind.Tables,
        name: SuggestionKind.Tables,
        suggestions: (_, m) => Promise.resolve([]),
      },
      {
        id: SuggestionKind.Columns,
        name: SuggestionKind.Columns,
        suggestions: (_, m) => Promise.resolve([]),
      },
      {
        id: SuggestionKind.LogicalOperators,
        name: SuggestionKind.LogicalOperators,
        suggestions: (_, m) =>
          Promise.resolve(
            operators
              .list()
              .filter((o) => o.type === OperatorType.Logical)
              .map((o) => ({
                label: o.operator,
                insertText: `${o.operator} `,
                documentation: o.description,
                command: TRIGGER_SUGGEST,
                sortText: CompletionItemPriority.MediumHigh,
                kind: CompletionItemKind.Operator,
              }))
          ),
      },
      {
        id: SuggestionKind.WhereKeyword,
        name: SuggestionKind.WhereKeyword,
        suggestions: (_, m) =>
          Promise.resolve([
            {
              label: 'WHERE',
              insertText: `WHERE `,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.MediumHigh,
              kind: CompletionItemKind.Keyword,
            },
          ]),
      },
      {
        id: SuggestionKind.ComparisonOperators,
        name: SuggestionKind.ComparisonOperators,
        suggestions: (_, m) =>
          Promise.resolve([
            ...operators
              .list()
              .filter((o) => o.type === OperatorType.Comparison)
              .map((o) => ({
                label: o.operator,
                insertText: `${o.operator} `,
                documentation: o.description,
                command: TRIGGER_SUGGEST,
                sortText: CompletionItemPriority.MediumHigh,
                kind: CompletionItemKind.Operator,
              })),
            {
              label: 'IN (...)',
              insertText: `IN ( $0 )`,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.Medium,
              kind: CompletionItemKind.Operator,
              insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
            },
            {
              label: 'NOT IN (...)',
              insertText: `NOT IN ( $0 )`,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.Medium,
              kind: CompletionItemKind.Operator,
              insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
            },
            {
              label: 'IS',
              insertText: `IS`,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.Medium,
              kind: CompletionItemKind.Operator,
            },
            {
              label: 'IS NOT',
              insertText: `IS NOT`,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.Medium,
              kind: CompletionItemKind.Operator,
            },
          ]),
      },
      {
        id: SuggestionKind.GroupByKeywords,
        name: SuggestionKind.GroupByKeywords,
        suggestions: (_, m) =>
          Promise.resolve([
            {
              label: 'GROUP BY',
              insertText: `GROUP BY `,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.MediumHigh,
              kind: CompletionItemKind.Keyword,
            },
          ]),
      },
      {
        id: SuggestionKind.OrderByKeywords,
        name: SuggestionKind.OrderByKeywords,
        suggestions: (_, m) =>
          Promise.resolve([
            {
              label: 'ORDER BY',
              insertText: `ORDER BY `,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.Medium,
              kind: CompletionItemKind.Keyword,
            },
            {
              label: 'ORDER BY(ascending)',
              insertText: `ORDER BY $1 ASC `,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.MediumLow,
              kind: CompletionItemKind.Snippet,
              insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
            },
            {
              label: 'ORDER BY(descending)',
              insertText: `ORDER BY $1 DESC`,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.MediumLow,
              kind: CompletionItemKind.Snippet,
              insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
            },
          ]),
      },
      {
        id: SuggestionKind.LimitKeyword,
        name: SuggestionKind.LimitKeyword,
        suggestions: (_, m) =>
          Promise.resolve([
            {
              label: 'LIMIT',
              insertText: `LIMIT `,
              command: TRIGGER_SUGGEST,
              sortText: CompletionItemPriority.MediumLow,
              kind: CompletionItemKind.Keyword,
            },
          ]),
      },
      {
        id: SuggestionKind.SortOrderDirectionKeyword,
        name: SuggestionKind.SortOrderDirectionKeyword,
        suggestions: (_, m) =>
          Promise.resolve(
            [ASC, DESC].map((o) => ({
              label: o,
              insertText: `${o} `,
              command: TRIGGER_SUGGEST,
              kind: CompletionItemKind.Keyword,
            }))
          ),
      },
      {
        id: SuggestionKind.NotKeyword,
        name: SuggestionKind.NotKeyword,
        suggestions: () =>
          Promise.resolve([
            {
              label: 'NOT',
              insertText: 'NOT',
              command: TRIGGER_SUGGEST,
              kind: CompletionItemKind.Keyword,
              sortText: CompletionItemPriority.High,
            },
          ]),
      },
      {
        id: SuggestionKind.BoolValues,
        name: SuggestionKind.BoolValues,
        suggestions: () =>
          Promise.resolve(
            ['TRUE', 'FALSE'].map((o) => ({
              label: o,
              insertText: `${o}`,
              command: TRIGGER_SUGGEST,
              kind: CompletionItemKind.Keyword,
              sortText: CompletionItemPriority.Medium,
            }))
          ),
      },
      {
        id: SuggestionKind.NullValue,
        name: SuggestionKind.NullValue,
        suggestions: () =>
          Promise.resolve(
            ['NULL'].map((o) => ({
              label: o,
              insertText: `${o}`,
              command: TRIGGER_SUGGEST,
              kind: CompletionItemKind.Keyword,
              sortText: CompletionItemPriority.Low,
            }))
          ),
      },
    ];

export const initFunctionsRegistry = (): FunctionsRegistryItem[] => [
  ...STD_STATS.map((s) => ({
    id: s,
    name: s,
  })),
];

export const initMacrosRegistry = (): MacrosRegistryItem[] => [...MACROS];

export const initOperatorsRegistry = (): OperatorsRegistryItem[] => [
  ...STD_OPERATORS.map((o) => ({
    id: o,
    name: o,
    operator: o,
    type: OperatorType.Comparison,
  })),
  ...LOGICAL_OPERATORS.map((o) => ({ id: o, name: o.toUpperCase(), operator: o, type: OperatorType.Logical })),
];

function createMacroSuggestionItem(m: MacrosRegistryItem) {
  return {
    label: m.name,
    insertText: `${'\\' + m.text}${argsString(m.args)} `,
    insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
    kind: CompletionItemKind.Snippet,
    documentation: m.description,
    command: TRIGGER_SUGGEST,
  };
}

function argsString(args?: string[]): string {
  if (!args) {
    return '()';
  }
  return '('.concat(args.map((t, i) => `\${${i}:${t}}`).join(', ')).concat(')');
}
