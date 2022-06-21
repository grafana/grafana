import moment from 'moment/moment';

import { SourceDescription, FormattedTemplate, Template } from './AlertRuleTemplatesTable.types';

export const formatTemplate = (template: Template): FormattedTemplate => {
  const { summary, source, created_at, ...restProps } = template;

  return {
    summary,
    source: SourceDescription[source],
    created_at: created_at ? moment(created_at).format('YYYY-MM-DD HH:mm:ss') : undefined,
    ...restProps,
  };
};

export const formatTemplates = (templates: Template[]): FormattedTemplate[] => templates.map(formatTemplate);
