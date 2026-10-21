import { type APIRequestContext } from '@playwright/test';

import { test, expect } from './fixtures';
import { RuleListPage, filterLeaf } from './pages/RuleListPage';
import {
  RUN_LABEL,
  type RecordingRuleHealth,
  type RecordingRuleSeed,
  type RuleStatusSeed,
  newRunMarker,
  recordingMetricFor,
  runScope,
  runTitle,
  waitForRuleStatusVisible,
} from './ruleSeeding';

// Status is seeded via the status subresource (see setRuleStatus); a rule with no status must be left out.
interface StatusRule {
  name: string;
  health?: RecordingRuleHealth;
}

async function seedStatusRules(
  seedRule: (seed: RecordingRuleSeed) => Promise<string>,
  request: APIRequestContext,
  namespace: string,
  run: string,
  rules: StatusRule[]
): Promise<void> {
  const expected: Record<string, RuleStatusSeed> = {};
  for (const { name, health } of rules) {
    const status = health ? { health } : undefined;
    const uid = await seedRule({
      title: runTitle(run, name),
      metric: recordingMetricFor(run, name),
      paused: false,
      labels: { [RUN_LABEL]: run },
      status,
    });
    if (status) {
      expected[uid] = status;
    }
  }
  await waitForRuleStatusVisible(request, namespace, 'recordingrules', run, expected);
}

const NO_STATUS_RULE: StatusRule = { name: 'Rule without status' };

const healthCases: Array<{
  token: string;
  apiValues: string[];
  matching: RecordingRuleHealth;
  other: RecordingRuleHealth;
}> = [
  { token: 'health:ok', apiValues: ['Recording'], matching: 'Recording', other: 'Error' },
  { token: 'health:nodata', apiValues: ['NoData'], matching: 'NoData', other: 'Recording' },
  { token: 'health:error', apiValues: ['Error'], matching: 'Error', other: 'Recording' },
  { token: 'health:err', apiValues: ['Error'], matching: 'Error', other: 'Recording' },
  { token: 'health:unknown', apiValues: ['Unknown'], matching: 'Unknown', other: 'Recording' },
];

test.describe('Recording rules: health filter', () => {
  for (const { token, apiValues, matching, other } of healthCases) {
    test(`${token} shows rules with ${apiValues.join(' or ')} health and leaves out other health and rules without status`, async ({
      page,
      request,
      workerApi,
      recordingRules,
    }) => {
      const run = newRunMarker();
      const matchingRule: StatusRule = { name: `Rule with ${matching} health`, health: matching };
      const otherRule: StatusRule = { name: `Rule with ${other} health`, health: other };
      await seedStatusRules(recordingRules.seedRule.bind(recordingRules), request, workerApi.namespace, run, [
        matchingRule,
        otherRule,
        NO_STATUS_RULE,
      ]);

      const list = new RuleListPage(page, 'recording');
      await list.goto(runScope(run));
      list.forgetRequests();
      await list.search(`${runScope(run)} ${token}`);

      await list.expectRequestLeaf(filterLeaf('health', 'In', apiValues));
      await list.expectRules({
        shown: [runTitle(run, matchingRule.name)],
        hidden: [runTitle(run, otherRule.name), runTitle(run, NO_STATUS_RULE.name)],
      });
    });
  }

  test('the Health select filters by the chosen health', async ({ page, request, workerApi, recordingRules }) => {
    const run = newRunMarker();
    const failing: StatusRule = { name: 'Rule with Error health', health: 'Error' };
    const recording: StatusRule = { name: 'Rule with Recording health', health: 'Recording' };
    await seedStatusRules(recordingRules.seedRule.bind(recordingRules), request, workerApi.namespace, run, [
      failing,
      recording,
      NO_STATUS_RULE,
    ]);

    const list = new RuleListPage(page, 'recording');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.chooseOption('Health', 'Error');
    await list.expectRequestLeaf(filterLeaf('health', 'In', ['Error']));
    await list.expectSearchParam('health:error');
    await list.expectRules({
      shown: [runTitle(run, failing.name)],
      hidden: [runTitle(run, recording.name), runTitle(run, NO_STATUS_RULE.name)],
    });

    list.forgetRequests();
    await list.chooseOption('Health', 'OK');
    await list.expectRequestLeaf(filterLeaf('health', 'In', ['Recording']));
    await list.expectRules({
      shown: [runTitle(run, recording.name)],
      hidden: [runTitle(run, failing.name), runTitle(run, NO_STATUS_RULE.name)],
    });
  });
});

test.describe('Recording rules: status icon', () => {
  test('each row shows the icon for its seeded health, and Status unavailable when it has none', async ({
    page,
    request,
    workerApi,
    recordingRules,
  }) => {
    const run = newRunMarker();
    const rules: Array<StatusRule & { icon: string }> = [
      { name: 'Rule with Recording health', health: 'Recording', icon: 'Recording' },
      { name: 'Rule with Error health', health: 'Error', icon: 'Failed to evaluate rule' },
      { name: 'Rule with NoData health', health: 'NoData', icon: 'Insufficient data' },
      { ...NO_STATUS_RULE, icon: 'Status unavailable' },
    ];
    await seedStatusRules(recordingRules.seedRule.bind(recordingRules), request, workerApi.namespace, run, rules);

    const list = new RuleListPage(page, 'recording');
    await list.goto(runScope(run));

    for (const { name, icon } of rules) {
      await expect(list.statusIcon(runTitle(run, name), icon), `${name} shows ${icon}`).toBeVisible();
    }
  });
});
