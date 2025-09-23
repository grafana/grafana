import moment from 'moment/moment';

import { UNIT_MAP, SOURCE_MAP } from './AlertRuleTemplate.constants';
import { FormattedTemplate, SourceDescription, Template, TemplateParamUnit } from './AlertRuleTemplate.types';

export const formatTemplate = (template: Template): FormattedTemplate => {
  const { summary, source, created_at, ...restProps } = template;

  return {
    summary,
    source,
    created_at: created_at ? moment(created_at).format('YYYY-MM-DD HH:mm:ss') : undefined,
    ...restProps,
  };
};

export const formatTemplates = (templates: Template[]): FormattedTemplate[] => templates.map(formatTemplate);

export const beautifyUnit = (unit: TemplateParamUnit) => UNIT_MAP[unit];

export const formatSource = (source: SourceDescription) => SOURCE_MAP[source];

export const formatDate = (date: string | undefined) => date && moment(date).format('YYYY-MM-DD');
