import { languages } from 'monaco-editor';

export interface SuggestionDefinition extends Omit<languages.CompletionItem, 'range' | 'insertText'> {
  insertText?: languages.CompletionItem['insertText'];
}
