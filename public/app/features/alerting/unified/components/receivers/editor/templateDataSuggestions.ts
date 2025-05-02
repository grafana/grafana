import type { Monaco } from '@grafana/ui';

import {
  alertDetailsSnippet,
  alertsLoopSnippet,
  annotationsLoopSnippet,
  commonAnnotationsLoopSnippet,
  commonLabelsLoopSnippet,
  groupLabelsLoopSnippet,
  jsonSnippet,
  labelsLoopSnippet,
} from './snippets';
import { SuggestionDefinition } from './suggestionDefinition';

// Suggestions available at the top level of a template
export function getGlobalSuggestions(monaco: Monaco): SuggestionDefinition[] {
  const kind = monaco.languages.CompletionItemKind.Field;

  return [
    {
      label: 'Alerts',
      kind,
      detail: 'Alert[]',
      documentation: { value: 'An Array containing all alerts' },
    },
    { label: 'Receiver', kind, detail: 'string' },
    { label: 'Status', kind, detail: 'string' },
    { label: 'GroupLabels', kind, detail: '[]KeyValue' },
    { label: 'CommonLabels', kind, detail: '[]KeyValue' },
    { label: 'CommonAnnotations', kind, detail: '[]KeyValue' },
    { label: 'ExternalURL', kind, detail: 'string' },
    { label: 'GroupKey', kind, detail: 'string' },
    { label: 'TruncatedAlerts', kind, detail: 'integer' },
  ];
}

// Suggestions that are valid only in the scope of an alert (e.g. in the .Alerts loop)
export function getAlertSuggestions(monaco: Monaco): SuggestionDefinition[] {
  const kind = monaco.languages.CompletionItemKind.Field;

  return [
    {
      label: { label: 'Status', detail: '(Alert)', description: 'string' },
      kind,
      detail: 'string',
      documentation: { value: 'Status of the alert. It can be `firing` or `resolved`' },
    },
    {
      label: { label: 'Labels', detail: '(Alert)' },
      kind,
      detail: '[]KeyValue',
      documentation: { value: 'A set of labels attached to the alert.' },
    },
    {
      label: { label: 'Annotations', detail: '(Alert)' },
      kind,
      detail: '[]KeyValue',
      documentation: 'A set of annotations attached to the alert.',
    },
    {
      label: { label: 'StartsAt', detail: '(Alert)' },
      kind,
      detail: 'time.Time',
      documentation: 'Time the alert started firing.',
    },
    {
      label: { label: 'EndsAt', detail: '(Alert)' },
      kind,
      detail: 'time.Time',
      documentation:
        'Only set if the end time of an alert is known. Otherwise set to a configurable timeout period from the time since the last alert was received.',
    },
    {
      label: { label: 'GeneratorURL', detail: '(Alert)' },
      kind,
      detail: 'string',
      documentation: 'Back link to Grafana or external Alertmanager.',
    },
    {
      label: { label: 'SilenceURL', detail: '(Alert)' },
      kind,
      detail: 'string',
      documentation:
        'Link to Grafana silence for with labels for this alert pre-filled. Only for Grafana managed alerts.',
    },
    {
      label: { label: 'DashboardURL', detail: '(Alert)' },
      kind,
      detail: 'string',
      documentation: 'Link to Grafana dashboard, if alert rule belongs to one. Only for Grafana managed alerts.',
    },
    {
      label: { label: 'PanelURL', detail: '(Alert)' },
      kind,
      detail: 'string',
      documentation: 'Link to Grafana dashboard panel, if alert rule belongs to one. Only for Grafana managed alerts.',
    },
    {
      label: { label: 'Fingerprint', detail: '(Alert)' },
      kind,
      detail: 'string',
      documentation: 'Fingerprint that can be used to identify the alert.',
    },
    {
      label: { label: 'ValueString', detail: '(Alert)' },
      kind,
      detail: 'string',
      documentation: 'String that contains labels and values of each reduced expression in the alert.',
    },
    {
      label: { label: 'OrgID', detail: '(Alert)' },
      kind,
      detail: 'integer',
      documentation: 'The ID of the organization that owns the alert.',
    },
  ];
}

// Suggestions for .Alerts
export function getAlertsSuggestions(monaco: Monaco): SuggestionDefinition[] {
  const kind = monaco.languages.CompletionItemKind.Field;

  return [
    { label: 'Firing', kind, detail: 'Alert[]' },
    { label: 'Resolved', kind, detail: 'Alert[]' },
  ];
}

// Suggestions for the KeyValue types
export function getKeyValueSuggestions(monaco: Monaco): SuggestionDefinition[] {
  const kind = monaco.languages.CompletionItemKind.Field;

  return [
    { label: 'SortedPairs', kind, detail: '[]KeyValue' },
    { label: 'Names', kind, detail: '[]string' },
    { label: 'Values', kind, detail: '[]string' },
    {
      label: 'Remove',
      detail: 'KeyValue[] function(keys []string)',
      kind: monaco.languages.CompletionItemKind.Method,
    },
  ];
}

export const snippets = {
  alerts: {
    label: 'alertsloop',
    description: 'Renders a loop through alerts',
    snippet: alertsLoopSnippet,
  },
  alertDetails: {
    label: 'alertdetails',
    description: 'Renders all information available about the alert',
    snippet: alertDetailsSnippet,
  },
  groupLabels: {
    label: 'grouplabelsloop',
    description: 'Renders a loop through group labels',
    snippet: groupLabelsLoopSnippet,
  },
  commonLabels: {
    label: 'commonlabelsloop',
    description: 'Renders a loop through common labels',
    snippet: commonLabelsLoopSnippet,
  },
  commonAnnotations: {
    label: 'commonannotationsloop',
    description: 'Renders a loop through common annotations',
    snippet: commonAnnotationsLoopSnippet,
  },
  labels: {
    label: 'labelsloop',
    description: 'Renders a loop through labels',
    snippet: labelsLoopSnippet,
  },
  annotations: {
    label: 'annotationsloop',
    description: 'Renders a loop through annotations',
    snippet: annotationsLoopSnippet,
  },
  json: {
    label: 'json',
    description: 'Renders a JSON object',
    snippet: jsonSnippet,
  },
};

// Snippets
export function getSnippetsSuggestions(monaco: Monaco): SuggestionDefinition[] {
  const snippetKind = monaco.languages.CompletionItemKind.Snippet;
  const snippetInsertRule = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

  const { alerts, alertDetails, groupLabels, commonLabels, commonAnnotations, labels, annotations, json } = snippets;

  return [
    {
      label: alerts.label,
      documentation: alerts.description,
      kind: snippetKind,
      insertText: alerts.snippet,
      insertTextRules: snippetInsertRule,
    },
    {
      label: {
        label: alertDetails.label,
        detail: '(Alert)',
      },
      documentation: alertDetails.description,
      kind: snippetKind,
      insertText: alertDetails.snippet,
      insertTextRules: snippetInsertRule,
    },
    {
      label: groupLabels.label,
      documentation: groupLabels.description,
      kind: snippetKind,
      insertText: groupLabels.snippet,
      insertTextRules: snippetInsertRule,
    },
    {
      label: commonLabels.label,
      documentation: commonLabels.description,
      kind: snippetKind,
      insertText: commonLabels.snippet,
      insertTextRules: snippetInsertRule,
    },
    {
      label: commonAnnotations.label,
      documentation: commonAnnotations.description,
      kind: snippetKind,
      insertText: commonAnnotations.snippet,
      insertTextRules: snippetInsertRule,
    },
    {
      label: { label: labels.label, detail: '(Alert)' },
      documentation: labels.description,
      kind: snippetKind,
      insertText: labels.snippet,
      insertTextRules: snippetInsertRule,
    },
    {
      label: { label: annotations.label, detail: '(Alert)' },
      documentation: annotations.description,
      kind: snippetKind,
      insertText: annotations.snippet,
      insertTextRules: snippetInsertRule,
    },
    {
      label: json.label,
      documentation: json.description,
      kind: snippetKind,
      insertText: json.snippet,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.KeepWhitespace,
    },
  ];
}
