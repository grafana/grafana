import { concat } from 'lodash';
import { editor, IRange, languages, Position } from 'monaco-editor';

import { alertManagerSuggestions } from './alertManagerSuggestions';
import { SuggestionDefinition } from './suggestionDefinition';
import { alertSuggestions, globalSuggestions, keyValueSuggestions } from './templateDataSuggestions';

export const GoTemplateAutocompleteProvider: languages.CompletionItemProvider = {
  triggerCharacters: ['.'],
  provideCompletionItems(model, position, context): languages.ProviderResult<languages.CompletionList> {
    const insideExpression = isInsideGoExpression(model, position);

    if (!insideExpression) {
      return { suggestions: [] };
    }

    console.log(context);

    const word = model.getWordUntilPosition(position);

    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn,
    };

    const builder = new CompletionBuilder(range);

    if (context.triggerKind === languages.CompletionTriggerKind.Invoke && !context.triggerCharacter) {
      return builder.getFunctionsSuggestions();
    }

    const wordBeforeDot = model.getWordUntilPosition({
      lineNumber: position.lineNumber,
      column: position.column - 1,
    });

    return builder.getTemplateDataSuggestions(wordBeforeDot.word);
  },
};

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

export class CompletionBuilder {
  constructor(private readonly range: IRange) {}

  getFunctionsSuggestions = (): languages.ProviderResult<languages.CompletionList> => {
    return this.getCompletionsFromDefinitions(alertManagerSuggestions);
  };

  getTemplateDataSuggestions = (wordContext: string): languages.ProviderResult<languages.CompletionList> => {
    switch (wordContext) {
      case '':
        return this.getCompletionsFromDefinitions(globalSuggestions, alertSuggestions);
      case 'Alerts':
        return this.getCompletionsFromDefinitions(alertSuggestions);
      case 'GroupLabels':
      case 'CommonLabels':
      case 'CommonAnnotations':
        return this.getCompletionsFromDefinitions(keyValueSuggestions);
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
  { label, type, docs, kind }: SuggestionDefinition,
  range: IRange
): languages.CompletionItem {
  return {
    label: label,
    kind: kind,
    insertText: label,
    range,
    documentation: docs,
    detail: type,
  };
}
