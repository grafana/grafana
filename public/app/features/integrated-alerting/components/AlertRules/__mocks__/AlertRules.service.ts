import { rulesStubs } from './alertRulesStubs';

import * as alertRulesService from '../AlertRules.service';

export const AlertRulesService = jest.genMockFromModule<typeof alertRulesService>('../AlertRules.service')
  .AlertRulesService;

AlertRulesService.list = () => Promise.resolve({ rules: rulesStubs });
AlertRulesService.create = () => Promise.resolve({ rule_id: 'test_id' });
