import {
  TemplateFloatParam,
  TemplateParamUnit,
} from 'app/percona/integrated-alerting/components/AlertRuleTemplate/AlertRuleTemplate.types';
import { beautifyUnit } from 'app/percona/integrated-alerting/components/AlertRuleTemplate/AlertRuleTemplate.utils';

export const Messages = {
  channels: {
    email: 'Email',
    pagerDuty: 'PagerDuty',
    slack: 'Slack',
  },
  tooltips: {
    template: 'The alert template to use for this rule.',
    name: 'The name for this rule.',
    duration:
      'Once condition is breached, alert will go into pending state. If it is pending for longer than this value, it will become a firing alert.',
    severity: 'The severity level for the alert triggered by this rule.',
    channels: 'Which contact points should be used to send the alert through.',
    filters: 'Apply rule only to required services or nodes.',
  },
  filter: {
    header: 'Filters',
    addButton: 'Add Filter',
    fieldLabel: 'Label',
    fieldOperators: 'Operators',
    fieldRegex: 'Regex',
  },
  errors: {
    template: 'Must select a template',
    name: 'Must enter an alert name',
    floatParamRequired: (name: string) => `Must enter a value for ${name}`,
    floatParamMin: (min: number) => `Must be at least ${min}`,
    floatParamMax: (max: number) => `Must be at most ${max}`,
    durationRequired: 'Must enter a duration',
    durationMin: 'Duration must be at least 60s, which is our default evaluation interval',
    severity: 'Must select a severity',
    filterLabel: 'Must enter a label',
    filterRegex: 'Must enter a regex',
    operatorRequired: 'Must select an operator',
  },
  title: 'Add Alert Rule',
  addRuleTitle: 'Add Alert Rule',
  editRuleTitle: 'Edit Alert Rule',
  create: 'Add',
  update: 'Save',
  cancel: 'Cancel',
  createSuccess: 'Alert rule created',
  updateSuccess: 'Alert rule updated',
  templateField: 'Template',
  nameField: 'Name',
  thresholdField: 'Threshold',
  durationField: 'Duration',
  severityField: 'Severity',
  channelField: 'Contact points',
  activateSwitch: 'Activate',
  templateExpression: 'Template Expression',
  ruleAlert: 'Rule Alert',
  advanced: 'Advanced details',
  loadingTemplates: 'Loading templates...',
  loadingContactPoints: 'Loading contact points...',
  getFloatDescription: (summary: string, unit?: TemplateParamUnit, float?: TemplateFloatParam) => {
    if (!float) {
      return '';
    }

    const { hasMin, hasMax, min = 0, max = 0 } = float;
    const paramDetails: string[] = [];

    if (!!unit) {
      paramDetails.push(beautifyUnit(unit));
    }

    if (hasMin) {
      paramDetails.push(`min: ${min}`);
    }

    if (hasMax) {
      paramDetails.push(`max: ${max}`);
    }

    return `${summary} (${paramDetails.join(', ')})`;
  },
};
