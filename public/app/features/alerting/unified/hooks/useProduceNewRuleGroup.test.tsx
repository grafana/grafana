import { HttpResponse } from 'msw';
import React from 'react';
import { render, userEvent, screen } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../mockApi';
import { mockCombinedRule, mockCombinedRuleGroup, mockGrafanaRulerRule } from '../mocks';
import { grafanaRulerGroupName, grafanaRulerNamespace, grafanaRulerRule } from '../mocks/alertRuleApi';
import { setUpdateRulerRuleNamespaceHandler } from '../mocks/server/configure';
import { serializeRequest, waitForServerRequest } from '../mocks/server/events';
import { stringifyErrorLike } from '../utils/misc';
import { getRuleGroupLocationFromCombinedRule } from '../utils/rules';

import { usePauseRuleInGroup } from './useProduceNewRuleGroup';

setupMswServer();

beforeAll(() => {
  setBackendSrv(backendSrv);
});

it('should be able to pause a rule', async () => {
  const handler = setUpdateRulerRuleNamespaceHandler({ delay: 1000 });

  render(<TestComponent />);
  expect(byText(/uninitialized/i).get()).toBeInTheDocument();

  await userEvent.click(byRole('button').get());
  expect(await byText(/loading/i).find()).toBeInTheDocument();

  const request = await waitForServerRequest(handler);
  expect(await serializeRequest(request)).toMatchSnapshot();

  expect(await byText(/success/i).find()).toBeInTheDocument();
  expect(byText(/error/i).query()).not.toBeInTheDocument();
});

it('should throw if the rule is not found in the group', async () => {
  setUpdateRulerRuleNamespaceHandler();
  render(
    <TestComponent
      rulerRule={mockGrafanaRulerRule({ uid: 'does-not-exist', namespace_uid: grafanaRulerNamespace.uid })}
    />
  );
  expect(byText(/uninitialized/i).get()).toBeInTheDocument();

  await userEvent.click(byRole('button').get());
  expect(await byText(/error: No rule with UID/i).find()).toBeInTheDocument();
});

it('should be able to handle error', async () => {
  setUpdateRulerRuleNamespaceHandler({
    delay: 1000,
    error: new HttpResponse('oops', { status: 500 }),
  });

  render(<TestComponent />);

  expect(await byText(/uninitialized/i).find()).toBeInTheDocument();

  await userEvent.click(byRole('button').get());
  expect(await byText(/loading/i).find()).toBeInTheDocument();
  expect(await byText(/success/i).query()).not.toBeInTheDocument();
  expect(await byText(/error: oops/i).find()).toBeInTheDocument();
});

// this test component will cycle through the loading states
const TestComponent = (options: { rulerRule?: RulerGrafanaRuleDTO }) => {
  const [pauseRule, requestState] = usePauseRuleInGroup();

  const rulerRule = options.rulerRule ?? grafanaRulerRule;
  const rule = mockCombinedRule({
    rulerRule,
    group: mockCombinedRuleGroup(grafanaRulerGroupName, []),
  });
  const ruleGroupID = getRuleGroupLocationFromCombinedRule(rule);

  const onClick = () => {
    pauseRule(ruleGroupID, rulerRule, true);
  };

  return (
    <>
      <button onClick={() => onClick()} />
      {requestState.isUninitialized && 'uninitialized'}
      {requestState.isLoading && 'loading'}
      {requestState.isSuccess && 'success'}
      {requestState.isError && `error: ${stringifyErrorLike(requestState.error)}`}
    </>
  );
};
