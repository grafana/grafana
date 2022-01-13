import { SourceDescription, FormattedTemplate, Template } from './AlertRuleTemplatesTable.types';
import moment from 'moment/moment';

export const formatTemplate = (template: Template): FormattedTemplate => {
  const { summary, source, created_at } = template;

  return {
    summary,
    source: SourceDescription[source],
    created_at: moment(created_at).format('YYYY-MM-DD HH:mm:ss'),
  };
};

export const formatTemplates = (templates: Template[]): FormattedTemplate[] => templates.map(formatTemplate);
