import { UseQueryStateResult } from '@reduxjs/toolkit/dist/query/react/buildHooks';
import { waitFor, renderHook } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';

import { setupMswServer } from '../mockApi';
import { grafanaRulerGroupName, grafanaRulerNamespace, grafanaRulerRule } from '../mocks/alertRuleApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { usePauseRuleInGroup } from './useProduceNewRuleGroup';

setupMswServer();

beforeAll(() => {
  setBackendSrv(backendSrv);
});

it('should be able to pause a rule', async () => {
  const ruleGroupIdentifier: RuleGroupIdentifier = {
    namespace: grafanaRulerNamespace.uid,
    group: grafanaRulerGroupName,
    ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
  };

  expect(grafanaRulerRule).toHaveProperty('grafana_alert.is_paused', false);

  const { result } = renderHook(() => {
    const [pauseRule, pauseState] = usePauseRuleInGroup();
    pauseRule(ruleGroupIdentifier, grafanaRulerRule, true);

    return pauseState;
  });

  await waitFor(() => {
    expect(result.current).toHaveProperty('status', 'fulfilled');
  });

  // a bit hacky to inspect what was passed in to RTKQ – open to ideas
  expect(result.current).toHaveProperty('originalArgs.payload.rules[0].grafana_alert.is_paused', true);

  // @ts-ignore
  expect(result.current).toMatchSnapshot({
    fulfilledTimeStamp: expect.any(Number),
    startedTimeStamp: expect.any(Number),
    requestId: expect.any(String),
  });
});
