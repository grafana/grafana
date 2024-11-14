import { getTemplateSrv, TemplateSrv } from '@grafana/runtime';
import type { Monaco, monacoTypes } from '@grafana/ui';

import { ResourcesAPI } from '../../../resources/ResourcesAPI';
import { CompletionItemProvider } from '../../monarch/CompletionItemProvider';
import { LinkedToken } from '../../monarch/LinkedToken';
import { TRIGGER_SUGGEST } from '../../monarch/commands';
import { SuggestionKind, CompletionItemPriority, StatementPosition } from '../../monarch/types';
import {
  METRIC_MATH_FNS,
  METRIC_MATH_KEYWORDS,
  METRIC_MATH_OPERATORS,
  METRIC_MATH_PERIODS,
  METRIC_MATH_STATISTIC_KEYWORD_STRINGS,
} from '../language';

import { getStatementPosition } from './statementPosition';
import { getSuggestionKinds } from './suggestionKind';
import { MetricMathTokenTypes } from './types';

type CompletionItem = monacoTypes.languages.CompletionItem;

export class MetricMathCompletionItemProvider extends CompletionItemProvider {
  constructor(resources: ResourcesAPI, templateSrv: TemplateSrv = getTemplateSrv()) {
    super(resources, templateSrv);
    this.getStatementPosition = getStatementPosition;
    this.getSuggestionKinds = getSuggestionKinds;
    this.tokenTypes = MetricMathTokenTypes;
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
        case SuggestionKind.FunctionsWithArguments:
          METRIC_MATH_FNS.map((f) =>
            addSuggestion(f, {
              insertText: f === 'SEARCH' ? `${f}('$0')` : `${f}($0)`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              command: TRIGGER_SUGGEST,
              kind: monaco.languages.CompletionItemKind.Function,
            })
          );
          break;

        case SuggestionKind.KeywordArguments:
          METRIC_MATH_KEYWORDS.map((s) =>
            addSuggestion(s, {
              insertText: s,
              command: TRIGGER_SUGGEST,
              kind: monaco.languages.CompletionItemKind.Keyword,
              sortText: CompletionItemPriority.MediumHigh,
            })
          );
          break;

        case SuggestionKind.Statistic:
          METRIC_MATH_STATISTIC_KEYWORD_STRINGS.map((s) =>
            addSuggestion(s, {
              insertText: `'${s}', `,
              command: TRIGGER_SUGGEST,
            })
          );
          break;

        case SuggestionKind.Operators:
          METRIC_MATH_OPERATORS.map((s) =>
            addSuggestion(s, {
              insertText: `${s} `,
              command: TRIGGER_SUGGEST,
            })
          );
          break;

        case SuggestionKind.Period:
          addSuggestion('$__period_auto', {
            kind: monaco.languages.CompletionItemKind.Variable,
            sortText: 'a',
            detail: 'Sets period dynamically to adjust to selected time range.',
          });
          METRIC_MATH_PERIODS.map((s, idx) =>
            addSuggestion(s.toString(), {
              kind: monaco.languages.CompletionItemKind.Value,
              sortText: String.fromCharCode(97 + idx), // converts index 0, 1 to "a", "b", etc needed to show the time periods in numerical order
            })
          );
          break;
      }
    }

    // always suggest template variables
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
