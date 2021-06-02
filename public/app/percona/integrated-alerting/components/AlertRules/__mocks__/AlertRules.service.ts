import { rulesStubs } from './alertRulesStubs';

import * as alertRulesService from '../AlertRules.service';

export const AlertRulesService = jest.genMockFromModule<typeof alertRulesService>('../AlertRules.service')
  .AlertRulesService;

AlertRulesService.list = () => Promise.resolve({ rules: rulesStubs, totals: { total_pages: 1, total_items: 10 } });
AlertRulesService.create = () => Promise.resolve({ rule_id: 'test_id' });
AlertRulesService.toggle = () => Promise.resolve();
