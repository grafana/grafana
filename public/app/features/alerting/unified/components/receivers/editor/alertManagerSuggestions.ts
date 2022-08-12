import { languages } from 'monaco-editor';

import { AlertmanagerTemplateFunction } from './language';
import { SuggestionDefinition } from './suggestionDefinition';

const kind = languages.CompletionItemKind.Function;

export const alertManagerSuggestions: SuggestionDefinition[] = [
  {
    label: AlertmanagerTemplateFunction.toUpper,
    type: 'function(s string)',
    kind,
  },
  {
    label: AlertmanagerTemplateFunction.toLower,
    type: 'function(s string)',
    kind,
  },
  {
    label: AlertmanagerTemplateFunction.title,
    docs: 'Capitalizes the first letter of each word',
    type: 'function(s string)',
    kind,
  },
  {
    label: AlertmanagerTemplateFunction.join,
    docs: { value: 'Joins an array of strings using the separator provided.' },
    type: 'function(separator string, s []string)',
    kind,
  },
  {
    label: AlertmanagerTemplateFunction.match,
    type: 'function',
    kind,
  },
  {
    label: AlertmanagerTemplateFunction.safeHtml,
    type: 'function(pattern, repl, text)',
    kind,
  },
  {
    label: AlertmanagerTemplateFunction.reReplaceAll,
    type: 'function(pattern, repl, text)',
    kind,
  },
  {
    label: AlertmanagerTemplateFunction.stringSlice,
    type: 'function(s ...string)',
    kind,
  },
];
