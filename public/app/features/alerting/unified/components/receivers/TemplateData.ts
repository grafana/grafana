export interface TemplateDataItem {
  name: string;
  type: 'string' | '[]Alert' | 'KeyValue' | 'time.Time';
  notes: string;
}

interface TemplateFunctionItem {
  name: string;
  args?: '[]string';
  returns: 'KeyValue' | '[]string';
  notes?: string;
}

export const GlobalTemplateData: TemplateDataItem[] = [
  {
    name: 'Receiver',
    type: 'string',
    notes: 'Name of the contact point that the notification is being sent to.',
  },
  {
    name: 'Status',
    type: 'string',
    notes: 'firing if at least one alert is firing, otherwise resolved',
  },
  {
    name: 'Alerts',
    type: '[]Alert',
    notes: 'List of alert objects that are included in this notification.',
  },
  {
    name: 'Alerts.Firing',
    type: '[]Alert',
    notes: 'List of firing alerts',
  },
  {
    name: 'Alerts.Resolved',
    type: '[]Alert',
    notes: 'List of resolved alerts',
  },
  {
    name: 'GroupLabels',
    type: 'KeyValue',
    notes: 'Labels these alerts were grouped by.',
  },
  {
    name: 'CommonLabels',
    type: 'KeyValue',
    notes: 'Labels common to all the alerts included in this notification.',
  },
  {
    name: 'CommonAnnotations',
    type: 'KeyValue',
    notes: 'Annotations common to all the alerts included in this notification.',
  },
  {
    name: 'ExternalURL',
    type: 'string',
    notes: 'Back link to the Grafana that sent the notification.',
  },
];

export const AlertTemplatePreviewData: TemplateDataItem[] = [
  {
    name: 'Labels',
    type: 'KeyValue',
    notes: 'Set of labels attached to the alert.',
  },
  {
    name: 'Annotations',
    type: 'KeyValue',
    notes: 'Set of annotations attached to the alert.',
  },
  {
    name: 'StartsAt',
    type: 'time.Time',
    notes: 'Time the alert started firing.',
  },
  {
    name: 'EndsAt',
    type: 'time.Time',
    notes: 'Time the alert ends firing.',
  },
];

export const AlertTemplateData: TemplateDataItem[] = [
  {
    name: 'Status',
    type: 'string',
    notes: 'firing or resolved.',
  },
  {
    name: 'Labels',
    type: 'KeyValue',
    notes: 'Set of labels attached to the alert.',
  },
  {
    name: 'Annotations',
    type: 'KeyValue',
    notes: 'Set of annotations attached to the alert.',
  },
  {
    name: 'Values',
    type: 'KeyValue',
    notes:
      'The values of all instant queries, reduce and math expressions, and classic conditions for the alert. It does not contain time series data.',
  },
  {
    name: 'StartsAt',
    type: 'time.Time',
    notes: 'Time the alert started firing.',
  },
  {
    name: 'EndsAt',
    type: 'time.Time',
    notes:
      'Only set if the end time of an alert is known. Otherwise set to a configurable timeout period from the time since the last alert was received.',
  },
  {
    name: 'GeneratorURL',
    type: 'string',
    notes: 'A back link to Grafana or external Alertmanager.',
  },
  {
    name: 'SilenceURL',
    type: 'string',
    notes: 'Link to Grafana silence for with labels for this alert pre-filled. Only for Grafana managed alerts.',
  },
  {
    name: 'DashboardURL',
    type: 'string',
    notes: 'Link to Grafana dashboard, if alert rule belongs to one. Only for Grafana managed alerts.',
  },
  {
    name: 'PanelURL',
    type: 'string',
    notes: 'Link to Grafana dashboard panel, if alert rule belongs to one. Only for Grafana managed alerts.',
  },
  {
    name: 'Fingerprint',
    type: 'string',
    notes: 'Fingerprint that can be used to identify the alert.',
  },
  {
    name: 'ValueString',
    type: 'string',
    notes: 'String that contains the labels and value of each reduced expression in the alert.',
  },
];

export const KeyValueTemplateFunctions: TemplateFunctionItem[] = [
  {
    name: 'SortedPairs',
    returns: 'KeyValue',
    notes: 'Returns sorted list of key & value string pairs',
  },
  {
    name: 'Remove',
    args: '[]string',
    returns: 'KeyValue',
    notes: 'Returns a copy of the Key/Value map without the given keys.',
  },
  {
    name: 'Names',
    returns: '[]string',
    notes: 'List of label names',
  },
  {
    name: 'Values',
    returns: '[]string',
    notes: 'List of label values',
  },
];

export const KeyValueCodeSnippet = `{
  "summary": "alert summary",
  "description": "alert description"
}
`;
