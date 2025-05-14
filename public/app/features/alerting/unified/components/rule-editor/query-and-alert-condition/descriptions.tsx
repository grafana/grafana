import { RuleFormType } from '../../../types/rule-form';

type FormDescriptions = {
  sectionTitle: string;
  helpLabel: string;
  helpContent: string;
  helpLink: string;
};

export const DESCRIPTIONS: Record<RuleFormType, FormDescriptions> = {
  [RuleFormType.cloudRecording]: {
    sectionTitle: 'Define recording rule',
    helpLabel: 'Define your recording rule',
    helpContent:
      'Pre-compute frequently needed or computationally expensive expressions and save their result as a new set of time series.',
    helpLink: 'https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-recording-rules/',
  },
  [RuleFormType.grafanaRecording]: {
    sectionTitle: 'Define recording rule',
    helpLabel: 'Define your recording rule',
    helpContent:
      'Pre-compute frequently needed or computationally expensive expressions and save their result as a new set of time series.',
    helpLink: 'https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-recording-rules/',
  },
  [RuleFormType.grafana]: {
    sectionTitle: 'Define query and alert condition',
    helpLabel: 'Define query and alert condition',
    helpContent:
      'An alert rule consists of one or more queries and expressions that select the data you want to measure. Define queries and/or expressions and then choose one of them as the alert rule condition. This is the threshold that an alert rule must meet or exceed in order to fire. For more information on queries and expressions, see Query and transform data.',
    helpLink: 'https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/',
  },
  [RuleFormType.cloudAlerting]: {
    sectionTitle: 'Define query and alert condition',
    helpLabel: 'Define query and alert condition',
    helpContent:
      'An alert rule consists of one or more queries and expressions that select the data you want to measure. Define queries and/or expressions and then choose one of them as the alert rule condition. This is the threshold that an alert rule must meet or exceed in order to fire. For more information on queries and expressions, see Query and transform data.',
    helpLink: 'https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/',
  },
};
