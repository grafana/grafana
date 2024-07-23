import type { Monaco } from '@grafana/ui';

import {
  alertDetailsSnippet,
  alertsLoopSnippet,
  annotationsLoopSnippet,
  commonAnnotationsLoopSnippet,
  commonLabelsLoopSnippet,
  groupLabelsLoopSnippet,
  labelsLoopSnippet,
} from './snippets';
import { SuggestionDefinition } from './suggestionDefinition';

// Suggestions available at the top level of a template
export function getGlobalSuggestions(monaco: Monaco): SuggestionDefinition[] {
  const kind = monaco.languages.CompletionItemKind.Field;

  return [
    {
      label: 'alerts',
      kind,
      detail: 'alert[]',
      documentation: { value: 'An array containing all alerts' },
    },
    { label: 'receiver', kind, detail: 'string' },
    { label: 'status', kind, detail: 'string' },
    { label: 'groupLabels', kind, detail: '[]KeyValue' },
    { label: 'commonLabels', kind, detail: '[]KeyValue' },
    { label: 'commonAnnotations', kind, detail: '[]KeyValue' },
    { label: 'externalURL', kind, detail: 'string' },
  ];
}

// Suggestions that are valid only in the scope of an alert (e.g. in the .Alerts loop)
export function getAlertSuggestions(monaco: Monaco): SuggestionDefinition[] {
  const kind = monaco.languages.CompletionItemKind.Field;

  return [
    {
      label: { label: 'status', detail: '(alert)', description: 'string' },
      kind,
      detail: 'string',
      documentation: { value: 'Status of the alert. It can be `firing` or `resolved`' },
    },
    {
      label: { label: 'labels', detail: '(alert)' },
      kind,
      detail: '[]KeyValue',
      documentation: { value: 'A set of labels attached to the alert.' },
    },
    {
      label: { label: 'annotations', detail: '(alert)' },
      kind,
      detail: '[]KeyValue',
      documentation: 'A set of annotations attached to the alert.',
    },
    {
      label: { label: 'startsAt', detail: '(alert)' },
      kind,
      detail: 'time.Time',
      documentation: 'Time the alert started firing.',
    },
    {
      label: { label: 'endsAt', detail: '(alert)' },
      kind,
      detail: 'time.Time',
      documentation:
        'Only set if the end time of an alert is known. Otherwise set to a configurable timeout period from the time since the last alert was received.',
    },
    {
      label: { label: 'generatorURL', detail: '(alert)' },
      kind,
      detail: 'string',
      documentation: 'Back link to Grafana or external Alertmanager.',
    },
    {
      label: { label: 'silenceURL', detail: '(alert)' },
      kind,
      detail: 'string',
      documentation:
        'Link to Grafana silence for with labels for this alert pre-filled. Only for Grafana managed alerts.',
    },
    {
      label: { label: 'dashboardURL', detail: '(alert)' },
      kind,
      detail: 'string',
      documentation: 'Link to Grafana dashboard, if alert rule belongs to one. Only for Grafana managed alerts.',
    },
    {
      label: { label: 'panelURL', detail: '(alert)' },
      kind,
      detail: 'string',
      documentation: 'Link to Grafana dashboard panel, if alert rule belongs to one. Only for Grafana managed alerts.',
    },
    {
      label: { label: 'fingerprint', detail: '(alert)' },
      kind,
      detail: 'string',
      documentation: 'Fingerprint that can be used to identify the alert.',
    },
    {
      label: { label: 'valueString', detail: '(alert)' },
      kind,
      detail: 'string',
      documentation: 'String that contains labels and values of each reduced expression in the alert.',
    },
  ];
}

export function getStdSuggestions(monaco: Monaco): SuggestionDefinition[] {
  const kind = monaco.languages.CompletionItemKind.Field;

  return [{ label: 'extVar', kind, detail: 'string' }];
}

// Suggestions for .Alerts
export function getAlertsSuggestions(monaco: Monaco): SuggestionDefinition[] {
  const kind = monaco.languages.CompletionItemKind.Field;

  return [
    { label: 'firing', kind, detail: 'alert[]' },
    { label: 'resolved', kind, detail: 'alert[]' },
  ];
}

// Suggestions for the KeyValue types
export function getKeyValueSuggestions(monaco: Monaco): SuggestionDefinition[] {
  const kind = monaco.languages.CompletionItemKind.Field;

  return [
    { label: 'sortedPairs', kind, detail: '[]KeyValue' },
    { label: 'names', kind, detail: '[]string' },
    { label: 'values', kind, detail: '[]string' },
    {
      label: 'remove',
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
};

// Snippets
export function getSnippetsSuggestions(monaco: Monaco): SuggestionDefinition[] {
  const snippetKind = monaco.languages.CompletionItemKind.Snippet;
  const snippetInsertRule = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

  const { alerts, alertDetails, groupLabels, commonLabels, commonAnnotations, labels, annotations } = snippets;

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
        detail: '(alert)',
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
      label: { label: labels.label, detail: '(alert)' },
      documentation: labels.description,
      kind: snippetKind,
      insertText: labels.snippet,
      insertTextRules: snippetInsertRule,
    },
    {
      label: { label: annotations.label, detail: '(alert)' },
      documentation: annotations.description,
      kind: snippetKind,
      insertText: annotations.snippet,
      insertTextRules: snippetInsertRule,
    },
  ];
}
