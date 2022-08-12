import { IMarkdownString, languages } from 'monaco-editor';

export interface SuggestionDefinition {
  label: string;
  kind: languages.CompletionItemKind;
  type?: string;
  docs?: IMarkdownString | string;
}
