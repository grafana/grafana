import { FormattedTemplate, Template } from '../AlertRuleTemplate.types';
import { formatTemplates } from '../AlertRuleTemplate.utils';

export const templateStubs: Template[] = [
  {
    name: 'template_1',
    created_at: '2020-11-25T16:53:39.366Z',
    source: 'BUILT_IN',
    summary: 'MySQL database down',
    yaml: 'yaml file content',
  },
  {
    name: 'template_2',
    created_at: '2020-11-25T16:53:39.366Z',
    source: 'SAAS',
    summary: 'MongoDB database down',
    yaml: 'yaml file content',
  },
  {
    name: 'template_3',
    created_at: '2020-11-25T16:53:39.366Z',
    source: 'USER_FILE',
    summary: 'High memory consumption',
    yaml: 'yaml file content',
  },
];

export const formattedTemplateStubs: FormattedTemplate[] = formatTemplates(templateStubs);
