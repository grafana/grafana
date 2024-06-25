import { HttpResponse } from 'msw';
import React from 'react';
import { render, userEvent } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { CombinedRule } from 'app/types/unified-alerting';
import { RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../mockApi';
import {
  mockCombinedRule,
  mockCombinedRuleGroup,
  mockGrafanaRulerRule,
  mockRulerAlertingRule,
  mockRulerRecordingRule,
  mockRulerRuleGroup,
} from '../mocks';
import { grafanaRulerGroupName, grafanaRulerNamespace, grafanaRulerRule } from '../mocks/alertRuleApi';
import { setRulerRuleGroupHandler, setUpdateRulerRuleNamespaceHandler } from '../mocks/server/configure';
import { captureRequests, serializeRequests } from '../mocks/server/events';
import { rulerRuleGroupHandler, updateRulerRuleNamespaceHandler } from '../mocks/server/handlers/alertRules';
import { stringifyErrorLike } from '../utils/misc';
import { getRuleGroupLocationFromCombinedRule } from '../utils/rules';

import { isSuccess, isUninitialized, useDeleteRuleFromGroup, usePauseRuleInGroup } from './useProduceNewRuleGroup';

const server = setupMswServer();

beforeAll(() => {
  setBackendSrv(backendSrv);
});

describe('pause rule', () => {
  it('should be able to pause a rule', async () => {
    const capture = captureRequests();
    setUpdateRulerRuleNamespaceHandler({ delay: 0 });

    render(<PauseTestComponent />);
    expect(byText(/uninitialized/i).get()).toBeInTheDocument();

    await userEvent.click(byRole('button').get());
    expect(await byText(/loading/i).find()).toBeInTheDocument();

    expect(await byText(/success/i).find()).toBeInTheDocument();
    expect(await byText(/result/i).find()).toBeInTheDocument();
    expect(byText(/error/i).query()).not.toBeInTheDocument();

    const requests = await capture;
    const [get, update, ...rest] = await serializeRequests(requests);

    expect(update.body).toHaveProperty('rules[0].grafana_alert.is_paused', true);
    expect([get, update, ...rest]).toMatchSnapshot();
  });

  it('should throw if the rule is not found in the group', async () => {
    setUpdateRulerRuleNamespaceHandler();
    render(
      <PauseTestComponent
        rulerRule={mockGrafanaRulerRule({ uid: 'does-not-exist', namespace_uid: grafanaRulerNamespace.uid })}
      />
    );
    expect(byText(/uninitialized/i).get()).toBeInTheDocument();

    await userEvent.click(byRole('button').get());
    expect(await byText(/error: No rule with UID/i).find()).toBeInTheDocument();
  });

  it('should be able to handle error', async () => {
    setUpdateRulerRuleNamespaceHandler({
      delay: 0,
      response: new HttpResponse('oops', { status: 500 }),
    });

    render(<PauseTestComponent />);

    expect(await byText(/uninitialized/i).find()).toBeInTheDocument();

    await userEvent.click(byRole('button').get());
    expect(await byText(/loading/i).find()).toBeInTheDocument();
    expect(byText(/success/i).query()).not.toBeInTheDocument();
    expect(await byText(/error: oops/i).find()).toBeInTheDocument();
  });
});

describe('delete rule', () => {
  it('should be able to delete a Grafana managed rule', async () => {
    const rules = [
      mockCombinedRule({
        name: 'r1',
        rulerRule: mockGrafanaRulerRule({ uid: 'r1' }),
      }),
      mockCombinedRule({
        name: 'r2',
        rulerRule: mockGrafanaRulerRule({ uid: 'r2' }),
      }),
    ];
    const group = mockRulerRuleGroup({
      name: 'group-1',
      rules: [rules[0].rulerRule!, rules[1].rulerRule!],
    });

    const getGroup = rulerRuleGroupHandler({
      delay: 0,
      response: HttpResponse.json(group),
    });

    const updateNamespace = updateRulerRuleNamespaceHandler({
      response: new HttpResponse(undefined, { status: 200 }),
    });

    server.use(getGroup, updateNamespace);

    const capture = captureRequests();

    render(<DeleteTestComponent rule={rules[1]} />);

    await userEvent.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should be able to delete a Data source managed rule', async () => {
    setUpdateRulerRuleNamespaceHandler({
      response: new HttpResponse(undefined, { status: 200 }),
    });

    const rules = [
      mockCombinedRule({
        name: 'r1',
        rulerRule: mockRulerAlertingRule({ alert: 'r1', labels: { foo: 'bar' } }),
      }),
      mockCombinedRule({
        name: 'r2',
        rulerRule: mockRulerRecordingRule({ record: 'r2', labels: { bar: 'baz' } }),
      }),
    ];

    const group = mockRulerRuleGroup({
      name: 'group-1',
      rules: [rules[0].rulerRule!, rules[1].rulerRule!],
    });

    setRulerRuleGroupHandler({
      delay: 0,
      response: HttpResponse.json(group),
    });

    const capture = captureRequests();

    render(<DeleteTestComponent rule={rules[1]} />);

    await userEvent.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });

  it('should delete the entire group if no more rules are left', async () => {
    const capture = captureRequests();

    const combined = mockCombinedRule({
      rulerRule: grafanaRulerRule,
    });

    render(<DeleteTestComponent rule={combined} />);
    await userEvent.click(byRole('button').get());

    expect(await byText(/success/i).find()).toBeInTheDocument();

    const requests = await capture;
    const serializedRequests = await serializeRequests(requests);
    expect(serializedRequests).toMatchSnapshot();
  });
});

// this test component will cycle through the loading states
const PauseTestComponent = (options: { rulerRule?: RulerGrafanaRuleDTO }) => {
  const [pauseRule, requestState] = usePauseRuleInGroup();

  const rulerRule = options.rulerRule ?? grafanaRulerRule;
  const rule = mockCombinedRule({
    rulerRule,
    group: mockCombinedRuleGroup(grafanaRulerGroupName, []),
  });
  const ruleGroupID = getRuleGroupLocationFromCombinedRule(rule);

  const onClick = () => {
    // always handle your errors!
    pauseRule(ruleGroupID, rulerRule.grafana_alert.uid, true).catch(() => {});
  };

  return (
    <>
      <button onClick={() => onClick()} />
      {isUninitialized(requestState) && 'uninitialized'}
      {requestState.loading && 'loading'}
      {isSuccess(requestState) && 'success'}
      {isSuccess(requestState) && `result: ${JSON.stringify(requestState.value, null, 2)}`}
      {requestState.error && `error: ${stringifyErrorLike(requestState.error)}`}
    </>
  );
};

type DeleteTestComponentProps = {
  rule: CombinedRule;
};
const DeleteTestComponent = ({ rule }: DeleteTestComponentProps) => {
  const [deleteRuleFromGroup, requestState] = useDeleteRuleFromGroup();

  // always handle your errors!
  const ruleGroupID = getRuleGroupLocationFromCombinedRule(rule);
  const onClick = () => {
    deleteRuleFromGroup(ruleGroupID, rule.rulerRule!);
  };

  return (
    <>
      <button onClick={() => onClick()} />
      {isUninitialized(requestState) && 'uninitialized'}
      {requestState.loading && 'loading'}
      {isSuccess(requestState) && 'success'}
      {isSuccess(requestState) && `result: ${JSON.stringify(requestState.value, null, 2)}`}
      {requestState.error && `error: ${stringifyErrorLike(requestState.error)}`}
    </>
  );
};
