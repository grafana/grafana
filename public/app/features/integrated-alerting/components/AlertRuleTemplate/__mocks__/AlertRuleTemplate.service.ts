import { TemplatesList } from '../AlertRuleTemplate.types';
import { templateStubs } from './alertRuleTemplateStubs';

export const AlertRuleTemplateService = {
  async upload(): Promise<void> {
    return Promise.resolve();
  },
  async update(): Promise<void> {
    return Promise.resolve();
  },
  async list(): Promise<TemplatesList> {
    return { templates: templateStubs };
  },
};
