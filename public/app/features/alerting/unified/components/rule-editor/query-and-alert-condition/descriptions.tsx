import { RuleFormType } from '../../../types/rule-form';
import { DOCS_URL_QUERY_TRANSFORM_DATA, DOCS_URL_RECORDING_RULES } from '../../../utils/docs';

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
    helpLink: DOCS_URL_RECORDING_RULES,
  },
  [RuleFormType.grafanaRecording]: {
    sectionTitle: 'Define recording rule',
    helpLabel: 'Define your recording rule',
    helpContent:
      'Pre-compute frequently needed or computationally expensive expressions and save their result as a new set of time series.',
    helpLink: DOCS_URL_RECORDING_RULES,
  },
  [RuleFormType.grafana]: {
    sectionTitle: 'Define query and alert condition',
    helpLabel: 'Define query and alert condition',
    helpContent:
      'An alert rule consists of one or more queries and expressions that select the data you want to measure. Define queries and/or expressions and then choose one of them as the alert rule condition. This is the threshold that an alert rule must meet or exceed in order to fire. For more information on queries and expressions, see Query and transform data.',
    helpLink: DOCS_URL_QUERY_TRANSFORM_DATA,
  },
  [RuleFormType.cloudAlerting]: {
    sectionTitle: 'Define query and alert condition',
    helpLabel: 'Define query and alert condition',
    helpContent:
      'An alert rule consists of one or more queries and expressions that select the data you want to measure. Define queries and/or expressions and then choose one of them as the alert rule condition. This is the threshold that an alert rule must meet or exceed in order to fire. For more information on queries and expressions, see Query and transform data.',
    helpLink: DOCS_URL_QUERY_TRANSFORM_DATA,
  },
};
