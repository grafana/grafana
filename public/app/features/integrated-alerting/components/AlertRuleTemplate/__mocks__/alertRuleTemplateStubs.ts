import { Template, FormattedTemplate } from '../AlertRuleTemplatesTable/AlertRuleTemplatesTable.types';
import { formatTemplates } from '../AlertRuleTemplatesTable/AlertRuleTemplatesTable.utils';

export const templateStubs: Template[] = [
  {
    created_at: '2020-11-25T16:53:39.366Z',
    source: 'BUILT_IN',
    summary: 'MySQL database down',
    yaml: 'yaml file content',
  },
  {
    created_at: '2020-11-25T16:53:39.366Z',
    source: 'SAAS',
    summary: 'MongoDB database down',
    yaml: 'yaml file content',
  },
  {
    created_at: '2020-11-25T16:53:39.366Z',
    source: 'USER_FILE',
    summary: 'High memory consumption',
    yaml: 'yaml file content',
  },
];

export const formattedTemplateStubs: FormattedTemplate[] = formatTemplates(templateStubs);
