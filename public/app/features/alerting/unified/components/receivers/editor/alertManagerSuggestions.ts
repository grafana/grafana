import type { Monaco } from '@grafana/ui';

import { AlertmanagerTemplateFunction } from './language';
import { SuggestionDefinition } from './suggestionDefinition';

export function getAlertManagerSuggestions(monaco: Monaco): SuggestionDefinition[] {
  const kind = monaco.languages.CompletionItemKind.Function;
  return [
    {
      label: AlertmanagerTemplateFunction.toUpper,
      detail: 'function(s string)',
      kind,
    },
    {
      label: AlertmanagerTemplateFunction.toLower,
      detail: 'function(s string)',
      kind,
    },
    {
      label: AlertmanagerTemplateFunction.title,
      documentation: 'Capitalizes the first letter of each word',
      detail: 'function(s string)',
      kind,
    },
    {
      label: AlertmanagerTemplateFunction.join,
      documentation: { value: 'Joins an array of strings using the separator provided.' },
      detail: 'function(separator string, s []string)',
      kind,
    },
    {
      label: AlertmanagerTemplateFunction.match,
      detail: 'function',
      kind,
    },
    {
      label: AlertmanagerTemplateFunction.safeHtml,
      detail: 'function(pattern, repl, text)',
      kind,
    },
    {
      label: AlertmanagerTemplateFunction.reReplaceAll,
      detail: 'function(pattern, repl, text)',
      kind,
    },
    {
      label: AlertmanagerTemplateFunction.stringSlice,
      detail: 'function(s ...string)',
      kind,
    },
  ];
}
