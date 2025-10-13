import {
  FormattedTemplate,
  SourceDescription,
  Template,
  TemplateParamType,
  TemplateParamUnit,
} from '../AlertRuleTemplate.types';
import { formatTemplates } from '../AlertRuleTemplate.utils';

export const templateStubs: Template[] = [
  {
    name: 'template_1',
    created_at: '2020-11-25T16:53:39.366Z',
    source: SourceDescription.BUILT_IN,
    summary: 'MySQL database down',
    yaml: 'yaml file content',
    params: [
      {
        name: 'template-1-threshold',
        type: TemplateParamType.FLOAT,
        unit: TemplateParamUnit.PERCENTAGE,
        summary: 'a threshold',
        float: {
          hasDefault: true,
          hasMin: false,
          hasMax: false,
          default: 12,
        },
      },
    ],
    expr: 'template_1_expression',
    severity: 'SEVERITY_CRITICAL',
    for: '10s',
    annotations: {
      summary: 'template_1_alert_sample',
    },
  },
  {
    name: 'template_2',
    created_at: '2020-11-25T16:53:39.366Z',
    source: SourceDescription.SAAS,
    summary: 'MongoDB database down',
    yaml: 'yaml file content',
    params: [],
    expr: '',
    severity: 'SEVERITY_NOTICE',
    for: '300s',
  },
  {
    name: 'template_3',
    created_at: '2020-11-25T16:53:39.366Z',
    source: SourceDescription.USER_FILE,
    summary: 'High memory consumption',
    yaml: 'yaml file content',
    params: [],
    expr: '',
    severity: 'SEVERITY_WARNING',
    for: '15s',
  },
  {
    name: 'template_4',
    created_at: '2020-11-25T16:53:39.366Z',
    source: SourceDescription.USER_FILE,
    summary: 'Template',
    yaml: 'yaml file content',
    severity: 'SEVERITY_NOTICE',
    for: '20s',
    params: [
      {
        name: 'template-4-from',
        type: TemplateParamType.FLOAT,
        unit: TemplateParamUnit.PERCENTAGE,
        summary: 'a minimum threshold',
        float: {
          hasDefault: true,
          hasMin: false,
          hasMax: false,
          default: 10,
        },
      },
      {
        name: 'template-4-to',
        type: TemplateParamType.FLOAT,
        unit: TemplateParamUnit.PERCENTAGE,
        summary: 'a maximum threshold',
        float: {
          hasDefault: true,
          hasMin: false,
          hasMax: false,
          default: 50,
        },
      },
    ],
    expr: '',
  },
  {
    name: 'template_5',
    created_at: '2020-12-25T16:53:39.366Z',
    source: SourceDescription.SAAS,
    summary: 'Template',
    yaml: 'yaml file content',
    severity: 'SEVERITY_ERROR',
    for: '20s',
    params: [
      {
        name: 'template-5-from',
        type: TemplateParamType.FLOAT,
        unit: TemplateParamUnit.PERCENTAGE,
        summary: 'a minimum threshold',
        float: {
          hasDefault: true,
          hasMin: false,
          hasMax: false,
          default: 10,
        },
      },
      {
        name: 'template-5-to',
        type: TemplateParamType.FLOAT,
        unit: TemplateParamUnit.PERCENTAGE,
        summary: 'a maximum threshold',
        float: {
          hasDefault: true,
          hasMin: false,
          hasMax: false,
          default: 50,
        },
      },
    ],
    expr: '',
  },
  {
    name: 'template_6',
    created_at: '2020-11-25T16:53:39.366Z',
    source: SourceDescription.USER_API,
    summary: 'MySQL database down',
    yaml: 'yaml file content',
    params: [
      {
        name: 'template-6-threshold',
        type: TemplateParamType.FLOAT,
        unit: TemplateParamUnit.PERCENTAGE,
        summary: 'a threshold',
        float: {
          hasDefault: true,
          hasMin: false,
          hasMax: false,
          default: 12,
        },
      },
    ],
    expr: 'template_6_expression',
    severity: 'SEVERITY_CRITICAL',
    for: '10s',
    annotations: {
      summary: 'template_6_alert_sample',
    },
  },
];

export const formattedTemplateStubs: FormattedTemplate[] = formatTemplates(templateStubs);
