import type { Monaco, monacoTypes } from '@grafana/ui';

import { linkedTokenBuilder } from '../monarch/linkedTokenBuilder';
import { LanguageDefinition } from '../monarch/register';
import { Completeable, CompletionItemPriority, TokenTypes } from '../monarch/types';

import { DYNAMIC_LABEL_PATTERNS } from './language';

type CompletionItem = monacoTypes.languages.CompletionItem;

export class DynamicLabelsCompletionItemProvider implements Completeable {
  tokenTypes: TokenTypes;

  constructor() {
    this.tokenTypes = {
      Parenthesis: 'delimiter.parenthesis.cloudwatch-dynamicLabels',
      Whitespace: 'white.cloudwatch-dynamicLabels',
      Keyword: 'keyword.cloudwatch-dynamicLabels',
      Delimiter: 'delimiter.cloudwatch-dynamicLabels',
      Operator: 'operator.cloudwatch-dynamicLabels',
      Identifier: 'identifier.cloudwatch-dynamicLabels',
      Type: 'type.cloudwatch-dynamicLabels',
      Function: 'predefined.cloudwatch-dynamicLabels',
      Number: 'number.cloudwatch-dynamicLabels',
      String: 'string.cloudwatch-dynamicLabels',
      Variable: 'variable.cloudwatch-dynamicLabels',
    };
  }

  // called by registerLanguage and passed to monaco with registerCompletionItemProvider
  // returns an object that implements https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.CompletionItemProvider.html
  getCompletionProvider(monaco: Monaco, languageDefinition: LanguageDefinition) {
    return {
      triggerCharacters: [' ', '$', ',', '(', "'"], // one of these characters indicates that it is time to look for a suggestion
      provideCompletionItems: async (model: monacoTypes.editor.ITextModel, position: monacoTypes.IPosition) => {
        const currentToken = linkedTokenBuilder(monaco, languageDefinition, model, position, this.tokenTypes);
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
        let suggestions: CompletionItem[] = [];
        const next = currentToken?.next;
        if (!currentToken?.isFunction() && (!next || next.isWhiteSpace())) {
          suggestions = DYNAMIC_LABEL_PATTERNS.map((val) => toCompletionItem(val));
          // always insert suggestion for dimension value and allow user to complete pattern by providing the dimension name
          suggestions.push(
            toCompletionItem("${PROP('Dim.')}", {
              sortText: CompletionItemPriority.High,
              insertText: `\${PROP('Dim.$0')} `,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            })
          );
        }

        return {
          suggestions,
        };
      },
    };
  }
}
