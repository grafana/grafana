import { languages } from 'monaco-editor';

import { SuggestionDefinition } from './suggestionDefinition';

const kind = languages.CompletionItemKind.Field;

// Suggestions available at the top level of a template
export const globalSuggestions: SuggestionDefinition[] = [
  {
    label: 'Alerts',
    kind,
    type: 'Alert[]',
    docs: { value: 'An Array containing all alerts' },
  },
  { label: 'Receiver', kind, type: 'string' },
  { label: 'Status', kind, type: 'string' },
  { label: 'GroupLabels', kind, type: '[]KeyValue' },
  { label: 'CommonLabels', kind, type: '[]KeyValue' },
  { label: 'CommonAnnotations', kind, type: '[]KeyValue' },
  { label: 'ExternalURL', kind, type: 'string' },
];

// Suggestions that are valid only in the scope of an alert (e.g. in the .Alerts loop)
export const alertSuggestions: SuggestionDefinition[] = [
  { label: 'Status', kind, type: '(Alert) string' },
  { label: 'Labels', kind, type: '(Alert) []KeyValue' },
  { label: 'Annotations', kind, type: '(Alert) []KeyValue' },
  { label: 'StartsAt', kind, type: 'time.Time' },
  { label: 'EndsAt', kind, type: 'time.Time' },
  { label: 'GeneratorURL', kind, type: 'string' },
  { label: 'SilenceURL', kind, type: 'string' },
  { label: 'DashboardURL', kind, type: 'string' },
  { label: 'PanelURL', kind, type: 'string' },
  { label: 'Fingerprint', kind, type: 'string' },
  { label: 'ValueString', kind, type: 'string' },
];

// Suggestions for .Alerts
export const alertsSuggestions: SuggestionDefinition[] = [
  { label: 'Firing', kind, type: 'Alert[]' },
  { label: 'Resolved', kind, type: 'Alert[]' },
];

// Suggestions for the KeyValue types
export const keyValueSuggestions: SuggestionDefinition[] = [
  { label: 'SortedPairs', kind, type: '[]KeyValue' },
  { label: 'Names', kind, type: '[]string' },
  { label: 'Values', kind, type: '[]string' },
  {
    label: 'Remove',
    type: 'KeyValue[] function(keys []string)',
    kind: languages.CompletionItemKind.Method,
  },
];
