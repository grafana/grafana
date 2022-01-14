import {
  FormattedTemplate,
  Severity,
  Template,
  TemplateParamType,
  TemplateParamUnit,
} from '../AlertRuleTemplate.types';
import { formatTemplates } from '../AlertRuleTemplate.utils';

export const templateStubs: Template[] = [
  {
    name: 'template_1',
    created_at: '2020-11-25T16:53:39.366Z',
    source: 'BUILT_IN',
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
    severity: Severity.SEVERITY_CRITICAL,
    for: '10s',
    annotations: {
      summary: 'template_1_alert_sample',
    },
  },
  {
    name: 'template_2',
    created_at: '2020-11-25T16:53:39.366Z',
    source: 'SAAS',
    summary: 'MongoDB database down',
    yaml: 'yaml file content',
    params: [],
    expr: '',
    severity: Severity.SEVERITY_NOTICE,
    for: '300s',
  },
  {
    name: 'template_3',
    created_at: '2020-11-25T16:53:39.366Z',
    source: 'USER_FILE',
    summary: 'High memory consumption',
    yaml: 'yaml file content',
    params: [],
    expr: '',
    severity: Severity.SEVERITY_WARNING,
    for: '15s',
  },
  {
    name: 'template_4',
    created_at: '2020-11-25T16:53:39.366Z',
    source: 'USER_FILE',
    summary: 'Template',
    yaml: 'yaml file content',
    severity: Severity.SEVERITY_NOTICE,
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
];

export const formattedTemplateStubs: FormattedTemplate[] = formatTemplates(templateStubs);
