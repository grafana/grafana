import { RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { mockRulerAlertingRule } from '../mocks';

export const GROUP_1 = 'group-1';
export const GROUP_2 = 'group-2';
export const GROUP_3 = 'group-3';
export const GROUP_4 = 'group-4';

export const NAMESPACE_1 = 'namespace-1';
export const NAMESPACE_2 = 'namespace-2';

export const group1: RulerRuleGroupDTO = {
  name: GROUP_1,
  interval: '1m',
  rules: [mockRulerAlertingRule()],
};

export const group2: RulerRuleGroupDTO = {
  name: GROUP_2,
  interval: '2m',
  rules: [mockRulerAlertingRule()],
};

export const group3: RulerRuleGroupDTO = {
  name: GROUP_3,
  interval: '1m',
  rules: [mockRulerAlertingRule()],
};

export const group4: RulerRuleGroupDTO = {
  name: GROUP_4,
  interval: '3m',
  rules: [mockRulerAlertingRule()],
};

export const namespace1 = [group1, group2];
export const namespace2 = [group3, group4];

export const namespaces: Record<string, RulerRuleGroupDTO[]> = {
  [NAMESPACE_1]: namespace1,
  [NAMESPACE_2]: namespace2,
};
