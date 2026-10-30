export interface SuggestionDefinition {
  label: string | { label: string; detail?: string; description?: string };
  kind: 'field' | 'method' | 'function' | 'snippet';
  detail?: string;
  documentation?: string | { value: string };
  insertText?: string;
  insertAsSnippet?: boolean;
}
