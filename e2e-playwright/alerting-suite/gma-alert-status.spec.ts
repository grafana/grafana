import { type APIRequestContext } from '@playwright/test';

import { test, expect } from './fixtures';
import { RuleListPage, filterLeaf } from './pages/RuleListPage';
import {
  type AlertRuleHealth,
  type AlertRuleSeed,
  type AlertRuleState,
  RUN_LABEL,
  type RuleStatusSeed,
  newRunMarker,
  runScope,
  waitForRuleStatusVisible,
} from './ruleSeeding';

// The E2E server never evaluates rules, so rule status is seeded through the status subresource
// (see setRuleStatus). `NotIn` and an unset status are different things, so every journey also seeds a
// rule with no status and expects the state and health filters to leave it out.
interface StatusRule {
  name: string;
  status?: RuleStatusSeed;
}

function titleOf(run: string, name: string): string {
  return `${name} ${run}`;
}

async function seedStatusRules(
  seedRule: (seed: AlertRuleSeed) => Promise<string>,
  request: APIRequestContext,
  namespace: string,
  run: string,
  rules: StatusRule[]
): Promise<void> {
  const expected: Record<string, RuleStatusSeed> = {};
  for (const { name, status } of rules) {
    const uid = await seedRule({
      title: titleOf(run, name),
      paused: false,
      labels: { [RUN_LABEL]: run },
      status,
    });
    if (status) {
      expected[uid] = status;
    }
  }
  await waitForRuleStatusVisible(request, namespace, 'alertrules', run, expected);
}

const NO_STATUS_RULE: StatusRule = { name: 'Rule without status' };

const stateCases: Array<{ token: string; apiValues: string[]; matching: AlertRuleState[]; other: AlertRuleState }> = [
  { token: 'state:firing', apiValues: ['Firing'], matching: ['Firing'], other: 'Pending' },
  { token: 'state:pending', apiValues: ['Pending'], matching: ['Pending'], other: 'Firing' },
  { token: 'state:recovering', apiValues: ['Recovering'], matching: ['Recovering'], other: 'Firing' },
  { token: 'state:normal', apiValues: ['Healthy', 'Inactive'], matching: ['Healthy', 'Inactive'], other: 'Firing' },
  { token: 'state:inactive', apiValues: ['Healthy', 'Inactive'], matching: ['Healthy', 'Inactive'], other: 'Firing' },
];

const healthCases: Array<{ token: string; apiValues: string[]; matching: AlertRuleHealth; other: AlertRuleHealth }> = [
  { token: 'health:ok', apiValues: ['OK'], matching: 'OK', other: 'Error' },
  { token: 'health:nodata', apiValues: ['NoData'], matching: 'NoData', other: 'OK' },
  { token: 'health:error', apiValues: ['Error'], matching: 'Error', other: 'OK' },
  { token: 'health:err', apiValues: ['Error'], matching: 'Error', other: 'OK' },
  { token: 'health:unknown', apiValues: ['Unknown'], matching: 'Unknown', other: 'OK' },
];

test.describe('Alert rules: state and health filters', () => {
  test.slow();

  for (const { token, apiValues, matching, other } of stateCases) {
    test(`SEARCH-5: ${token} shows rules in ${apiValues.join(' or ')} and leaves out other states and rules without status`, async ({
      page,
      request,
      workerApi,
      alertRules,
    }) => {
      const run = newRunMarker();
      const matchingRules = matching.map((state) => ({
        name: `Rule in ${state}`,
        status: { state, health: 'OK' } satisfies RuleStatusSeed,
      }));
      const otherRule = { name: `Rule in ${other}`, status: { state: other, health: 'OK' } satisfies RuleStatusSeed };
      await seedStatusRules(alertRules.seedRule.bind(alertRules), request, workerApi.namespace, run, [
        ...matchingRules,
        otherRule,
        NO_STATUS_RULE,
      ]);

      const list = new RuleListPage(page, 'alert');
      await list.goto(runScope(run));
      list.forgetRequests();
      await list.search(`${runScope(run)} ${token}`);

      await list.expectRequestLeaf(filterLeaf('state', 'In', apiValues));
      await list.expectRules({
        shown: matchingRules.map((matchingRule) => titleOf(run, matchingRule.name)),
        hidden: [titleOf(run, otherRule.name), titleOf(run, NO_STATUS_RULE.name)],
      });
    });
  }

  for (const { token, apiValues, matching, other } of healthCases) {
    test(`SEARCH-5: ${token} shows rules with ${apiValues.join(' or ')} health and leaves out other health and rules without status`, async ({
      page,
      request,
      workerApi,
      alertRules,
    }) => {
      const run = newRunMarker();
      const matchingRule = {
        name: `Rule with ${matching} health`,
        status: { state: 'Healthy', health: matching } satisfies RuleStatusSeed,
      };
      const otherRule = {
        name: `Rule with ${other} health`,
        status: { state: 'Healthy', health: other } satisfies RuleStatusSeed,
      };
      await seedStatusRules(alertRules.seedRule.bind(alertRules), request, workerApi.namespace, run, [
        matchingRule,
        otherRule,
        NO_STATUS_RULE,
      ]);

      const list = new RuleListPage(page, 'alert');
      await list.goto(runScope(run));
      list.forgetRequests();
      await list.search(`${runScope(run)} ${token}`);

      await list.expectRequestLeaf(filterLeaf('health', 'In', apiValues));
      await list.expectRules({
        shown: [titleOf(run, matchingRule.name)],
        hidden: [titleOf(run, otherRule.name), titleOf(run, NO_STATUS_RULE.name)],
      });
    });
  }

  test('SEARCH-5: the Alert state select filters by the chosen state', async ({
    page,
    request,
    workerApi,
    alertRules,
  }) => {
    const run = newRunMarker();
    const firing = { name: 'Rule in Firing', status: { state: 'Firing', health: 'OK' } satisfies RuleStatusSeed };
    const healthy = { name: 'Rule in Healthy', status: { state: 'Healthy', health: 'OK' } satisfies RuleStatusSeed };
    await seedStatusRules(alertRules.seedRule.bind(alertRules), request, workerApi.namespace, run, [
      firing,
      healthy,
      NO_STATUS_RULE,
    ]);

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.chooseOption('Alert state', 'Firing');
    await list.expectRequestLeaf(filterLeaf('state', 'In', ['Firing']));
    await list.expectSearchParam('state:firing');
    await list.expectRules({
      shown: [titleOf(run, firing.name)],
      hidden: [titleOf(run, healthy.name), titleOf(run, NO_STATUS_RULE.name)],
    });

    list.forgetRequests();
    await list.chooseOption('Alert state', 'Normal');
    await list.expectRequestLeaf(filterLeaf('state', 'In', ['Healthy', 'Inactive']));
    await list.expectRules({
      shown: [titleOf(run, healthy.name)],
      hidden: [titleOf(run, firing.name), titleOf(run, NO_STATUS_RULE.name)],
    });
  });

  test('SEARCH-5: the Health select filters by the chosen health', async ({ page, request, workerApi, alertRules }) => {
    const run = newRunMarker();
    const failing = {
      name: 'Rule with Error health',
      status: { state: 'Healthy', health: 'Error' } satisfies RuleStatusSeed,
    };
    const noData = {
      name: 'Rule with NoData health',
      status: { state: 'Healthy', health: 'NoData' } satisfies RuleStatusSeed,
    };
    await seedStatusRules(alertRules.seedRule.bind(alertRules), request, workerApi.namespace, run, [
      failing,
      noData,
      NO_STATUS_RULE,
    ]);

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.chooseOption('Health', 'Error');
    await list.expectRequestLeaf(filterLeaf('health', 'In', ['Error']));
    await list.expectSearchParam('health:error');
    await list.expectRules({
      shown: [titleOf(run, failing.name)],
      hidden: [titleOf(run, noData.name), titleOf(run, NO_STATUS_RULE.name)],
    });

    list.forgetRequests();
    await list.chooseOption('Health', 'No data');
    await list.expectRequestLeaf(filterLeaf('health', 'In', ['NoData']));
    await list.expectRules({
      shown: [titleOf(run, noData.name)],
      hidden: [titleOf(run, failing.name), titleOf(run, NO_STATUS_RULE.name)],
    });
  });
});

test.describe('Alert rules: status icon', () => {
  test.slow();

  test('ALERT-4: each row shows the icon for its seeded status, and Status unavailable when it has none', async ({
    page,
    request,
    workerApi,
    alertRules,
  }) => {
    const run = newRunMarker();
    const rules: Array<StatusRule & { icon: string }> = [
      { name: 'Rule in Firing', status: { state: 'Firing', health: 'OK' }, icon: 'Firing' },
      { name: 'Rule in Pending', status: { state: 'Pending', health: 'OK' }, icon: 'Pending' },
      { name: 'Rule in Recovering', status: { state: 'Recovering', health: 'OK' }, icon: 'Recovering' },
      { name: 'Rule in Healthy', status: { state: 'Healthy', health: 'OK' }, icon: 'Normal' },
      {
        name: 'Rule with Error health',
        status: { state: 'Healthy', health: 'Error' },
        icon: 'Failed to evaluate rule',
      },
      { name: 'Rule with NoData health', status: { state: 'Healthy', health: 'NoData' }, icon: 'Insufficient data' },
      { ...NO_STATUS_RULE, icon: 'Status unavailable' },
    ];
    await seedStatusRules(alertRules.seedRule.bind(alertRules), request, workerApi.namespace, run, rules);

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));

    for (const { name, icon } of rules) {
      await expect(list.statusIcon(titleOf(run, name), icon), `${name} shows ${icon}`).toBeVisible({ timeout: 20_000 });
    }
  });
});
