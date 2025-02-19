import { concat } from 'lodash';
import type { IDisposable, IRange, Position, editor, languages } from 'monaco-editor/esm/vs/editor/editor.api';

import type { Monaco } from '@grafana/ui';

import { getAlertManagerSuggestions } from './alertManagerSuggestions';
import { SuggestionDefinition } from './suggestionDefinition';
import {
  getAlertSuggestions,
  getAlertsSuggestions,
  getGlobalSuggestions,
  getKeyValueSuggestions,
  getSnippetsSuggestions,
} from './templateDataSuggestions';

export function registerGoTemplateAutocomplete(monaco: Monaco): IDisposable {
  const goTemplateAutocompleteProvider: languages.CompletionItemProvider = {
    triggerCharacters: ['.'],
    provideCompletionItems(model, position, context): languages.ProviderResult<languages.CompletionList> {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const completionProvider = new CompletionProvider(monaco, range);

      const insideExpression = isInsideGoExpression(model, position);
      if (!insideExpression) {
        return completionProvider.getSnippetsSuggestions();
      }

      if (context.triggerKind === monaco.languages.CompletionTriggerKind.Invoke && !context.triggerCharacter) {
        return completionProvider.getFunctionsSuggestions();
      }

      const wordBeforeDot = model.getWordUntilPosition({
        lineNumber: position.lineNumber,
        column: position.column - 1,
      });

      return completionProvider.getTemplateDataSuggestions(wordBeforeDot.word);
    },
  };

  return monaco.languages.registerCompletionItemProvider('go-template', goTemplateAutocompleteProvider);
}

function isInsideGoExpression(model: editor.ITextModel, position: Position) {
  const searchRange = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: model.getLineMinColumn(position.lineNumber),
    endColumn: model.getLineMaxColumn(position.lineNumber),
  };

  const goSyntaxRegex = '\\{\\{[a-zA-Z0-9._() "]+\\}\\}';
  const matches = model.findMatches(goSyntaxRegex, searchRange, true, false, null, true);

  return matches.some((match) => match.range.containsPosition(position));
}

export class CompletionProvider {
  constructor(
    private readonly monaco: Monaco,
    private readonly range: IRange
  ) {}

  getSnippetsSuggestions = (): languages.ProviderResult<languages.CompletionList> => {
    return this.getCompletionsFromDefinitions(getSnippetsSuggestions(this.monaco));
  };

  getFunctionsSuggestions = (): languages.ProviderResult<languages.CompletionList> => {
    return this.getCompletionsFromDefinitions(getAlertManagerSuggestions(this.monaco));
  };

  getTemplateDataSuggestions = (wordContext: string): languages.ProviderResult<languages.CompletionList> => {
    switch (wordContext) {
      case '':
        return this.getCompletionsFromDefinitions(getGlobalSuggestions(this.monaco), getAlertSuggestions(this.monaco));
      case 'Alerts':
        return this.getCompletionsFromDefinitions(getAlertsSuggestions(this.monaco));
      case 'GroupLabels':
      case 'CommonLabels':
      case 'CommonAnnotations':
      case 'Labels':
      case 'Annotations':
        return this.getCompletionsFromDefinitions(getKeyValueSuggestions(this.monaco));
      default:
        return { suggestions: [] };
    }
  };

  private getCompletionsFromDefinitions = (...args: SuggestionDefinition[][]): languages.CompletionList => {
    const allDefinitions = concat(...args);

    return {
      suggestions: allDefinitions.map((definition) => buildAutocompleteSuggestion(definition, this.range)),
    };
  };
}

function buildAutocompleteSuggestion(
  { label, detail, documentation, kind, insertText }: SuggestionDefinition,
  range: IRange
): languages.CompletionItem {
  const insertFallback = typeof label === 'string' ? label : label.label;
  const labelObject = typeof label === 'string' ? { label: label, description: detail } : { ...label };

  labelObject.description ??= detail;

  return {
    label: labelObject,
    kind: kind,
    insertText: insertText ?? insertFallback,
    range,
    documentation: documentation,
    detail: detail,
  };
}
