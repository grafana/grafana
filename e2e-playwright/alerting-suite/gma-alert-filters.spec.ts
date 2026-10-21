import { test } from './fixtures';
import { LABEL_RULES, labelFilterCases } from './labelFilterCases';
import { RuleListPage, filterLeaf } from './pages/RuleListPage';
import {
  type AlertRuleSeed,
  RUN_LABEL,
  newRunMarker,
  prometheusDataSourceUid,
  runScope,
  runTitle,
  testDataSourceUid,
} from './ruleSeeding';

function rule(run: string, name: string, extra: Partial<AlertRuleSeed> = {}): AlertRuleSeed {
  return { ...extra, title: runTitle(run, name), labels: { [RUN_LABEL]: run, ...extra.labels } };
}

test.describe('Alert rules: token filters', () => {
  test('rule: matches rule titles', async ({ page, alertRules }) => {
    const run = newRunMarker();
    await alertRules.seedRule(rule(run, 'Checkout latency high'));
    await alertRules.seedRule(rule(run, 'Disk space low'));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.search(`${runScope(run)} rule:latency`);

    await list.expectRequestLeaf({ text: { value: 'latency' } });
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high')],
      hidden: [runTitle(run, 'Disk space low')],
    });
  });

  test('free text matches rule titles like rule:', async ({ page, alertRules }) => {
    const run = newRunMarker();
    await alertRules.seedRule(rule(run, 'Checkout latency high'));
    await alertRules.seedRule(rule(run, 'Disk space low'));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.search(`${runScope(run)} space`);

    await list.expectRequestLeaf({ text: { value: 'space' } });
    await list.expectRules({
      shown: [runTitle(run, 'Disk space low')],
      hidden: [runTitle(run, 'Checkout latency high')],
    });
  });

  test('namespace: limits rules to the folder', async ({ page, folder, alertRules }) => {
    const run = newRunMarker();
    const otherFolder = await alertRules.createFolder(`Payments alerts ${run}`);
    await alertRules.seedRule(rule(run, 'Checkout latency high'));
    await alertRules.seedRule(rule(run, 'Disk space low', { folderUid: otherFolder.uid }));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.search(`${runScope(run)} namespace:${folder.uid}`);

    await list.expectRequestLeaf(filterLeaf('folder', 'In', [folder.uid]));
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high')],
      hidden: [runTitle(run, 'Disk space low')],
    });
  });

  test('datasource: limits rules to those querying the data source', async ({ page, alertRules }) => {
    const run = newRunMarker();
    await alertRules.seedRule(rule(run, 'Checkout latency high', { queryDataSourceUid: testDataSourceUid }));
    await alertRules.seedRule(rule(run, 'Disk space low', { queryDataSourceUid: prometheusDataSourceUid }));
    await alertRules.seedRule(rule(run, 'Memory pressure'));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.search(`${runScope(run)} datasource:${testDataSourceUid}`);

    await list.expectRequestLeaf(filterLeaf('datasourceUIDs', 'In', [testDataSourceUid]));
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high')],
      hidden: [runTitle(run, 'Disk space low'), runTitle(run, 'Memory pressure')],
    });
  });

  for (const { operator, token, leaf, shown, hidden } of labelFilterCases) {
    test(`${token} finds rules whose team label ${operator}`, async ({ page, alertRules }) => {
      const run = newRunMarker();
      await alertRules.seedRule(rule(run, LABEL_RULES.payments, { labels: { team: 'payments' } }));
      await alertRules.seedRule(rule(run, LABEL_RULES.checkout, { labels: { team: 'checkout' } }));
      await alertRules.seedRule(rule(run, LABEL_RULES.unowned));

      const list = new RuleListPage(page, 'alert');
      await list.goto(runScope(run));
      list.forgetRequests();
      await list.search(`${runScope(run)} ${token}`);

      await list.expectRequestLeaf(leaf);
      await list.expectRules({
        shown: shown.map((name) => runTitle(run, name)),
        hidden: hidden.map((name) => runTitle(run, name)),
      });
    });
  }

  test('plugins:hide removes rules owned by a plugin and keeps other origins', async ({ page, alertRules }) => {
    const run = newRunMarker();
    await alertRules.seedRule(rule(run, 'Checkout latency high'));
    await alertRules.seedRule(
      rule(run, 'Synthetic probe failing', { labels: { __grafana_origin: 'plugin/grafana-synthetic-monitoring-app' } })
    );
    await alertRules.seedRule(rule(run, 'Imported rule', { labels: { __grafana_origin: 'migration' } }));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    await list.expectRules({ shown: [runTitle(run, 'Synthetic probe failing')] });
    list.forgetRequests();
    await list.search(`${runScope(run)} plugins:hide`);

    await list.expectRequestLeaf({ regex: { field: 'labels', pattern: '__grafana_origin=plugin/.*', negate: true } });
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high'), runTitle(run, 'Imported rule')],
      hidden: [runTitle(run, 'Synthetic probe failing')],
    });
  });

  test('dashboard: limits rules to those linked to the dashboard', async ({ page, alertRules }) => {
    const run = newRunMarker();
    const dashboardUid = await alertRules.createDashboard(`Checkout overview ${run}`, [4, 7]);
    await alertRules.seedRule(rule(run, 'Checkout latency high', { panel: { dashboardUid, panelId: 4 } }));
    await alertRules.seedRule(rule(run, 'Disk space low'));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.search(`${runScope(run)} dashboard:${dashboardUid}`);

    await list.expectRequestLeaf(filterLeaf('dashboardUID', 'In', [dashboardUid]));
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high')],
      hidden: [runTitle(run, 'Disk space low')],
    });
  });

  test('panelId: narrows a dashboard filter to one panel', async ({ page, alertRules }) => {
    const run = newRunMarker();
    const dashboardUid = await alertRules.createDashboard(`Checkout overview ${run}`, [4, 7]);
    await alertRules.seedRule(rule(run, 'Checkout latency high', { panel: { dashboardUid, panelId: 4 } }));
    await alertRules.seedRule(rule(run, 'Checkout error rate', { panel: { dashboardUid, panelId: 7 } }));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.search(`${runScope(run)} dashboard:${dashboardUid} panelId:4`);

    await list.expectRequestLeaf(filterLeaf('panelID', 'In', ['4']));
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high')],
      hidden: [runTitle(run, 'Checkout error rate')],
    });
  });

  test('contactPoint: limits rules to those delivering directly to the contact point', async ({ page, alertRules }) => {
    const run = newRunMarker();
    const contactPointName = `payments-oncall-${run}`;
    await alertRules.createContactPoint(contactPointName);
    await alertRules.seedRule(rule(run, 'Checkout latency high', { receiver: contactPointName }));
    await alertRules.seedRule(rule(run, 'Disk space low'));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.search(`${runScope(run)} contactPoint:${contactPointName}`);

    await list.expectRequestLeaf(filterLeaf('receiver', 'In', [contactPointName]));
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high')],
      hidden: [runTitle(run, 'Disk space low')],
    });
  });

  test('policy: limits rules to those routed through the named policy', async ({ page, alertRules }) => {
    const run = newRunMarker();
    const policyName = `payments-policy-${run}`;
    await alertRules.createRoutingTree(policyName);
    await alertRules.seedRule(rule(run, 'Checkout latency high', { routingTree: policyName }));
    await alertRules.seedRule(rule(run, 'Disk space low'));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.search(`${runScope(run)} policy:${policyName}`);

    await list.expectRequestLeaf(filterLeaf('routingTree', 'In', [policyName]));
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high')],
      hidden: [runTitle(run, 'Disk space low')],
    });
  });

  test('paused:true shows only paused rules', async ({ page, alertRules }) => {
    const run = newRunMarker();
    await alertRules.seedRule(rule(run, 'Checkout latency high', { paused: true }));
    await alertRules.seedRule(rule(run, 'Disk space low', { paused: false }));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.search(`${runScope(run)} paused:true`);

    await list.expectRequestLeaf(filterLeaf('paused', 'In', ['true']));
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high')],
      hidden: [runTitle(run, 'Disk space low')],
    });
  });

  test('paused:false shows only rules that are not paused', async ({ page, alertRules }) => {
    const run = newRunMarker();
    await alertRules.seedRule(rule(run, 'Checkout latency high', { paused: true }));
    await alertRules.seedRule(rule(run, 'Disk space low', { paused: false }));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.search(`${runScope(run)} paused:false`);

    await list.expectRequestLeaf(filterLeaf('paused', 'In', ['false']));
    await list.expectRules({
      shown: [runTitle(run, 'Disk space low')],
      hidden: [runTitle(run, 'Checkout latency high')],
    });
  });
});

test.describe('Alert rules: sidebar filters', () => {
  test('Rule name filters by title', async ({ page, alertRules }) => {
    const run = newRunMarker();
    await alertRules.seedRule(rule(run, 'Checkout latency high'));
    await alertRules.seedRule(rule(run, 'Disk space low'));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.setRuleName('latency');

    await list.expectRequestLeaf({ text: { value: 'latency' } });
    await list.expectSearchParam('latency');
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high')],
      hidden: [runTitle(run, 'Disk space low')],
    });
  });

  test('Add label filter applies a key and value matcher', async ({ page, alertRules }) => {
    const run = newRunMarker();
    await alertRules.seedRule(rule(run, 'Payments rule', { labels: { team: 'payments' } }));
    await alertRules.seedRule(rule(run, 'Checkout rule', { labels: { team: 'checkout' } }));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    await list.addLabelFilter({ key: 'team', value: 'payments' });

    await list.expectRequestLeaf(filterLeaf('labels', 'In', ['team=payments']));
    await list.expectSearchParam('label:team=payments');
    await list.expectRules({
      shown: [runTitle(run, 'Payments rule')],
      hidden: [runTitle(run, 'Checkout rule')],
    });
  });

  test('a label row can switch to the exists operator', async ({ page, alertRules }) => {
    const run = newRunMarker();
    await alertRules.seedRule(rule(run, 'Payments rule', { labels: { team: 'payments' } }));
    await alertRules.seedRule(rule(run, 'Unowned rule'));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    await list.addLabelFilter({ key: 'team', operator: 'exists' });

    await list.expectRequestLeaf(filterLeaf('labels', 'In', ['team']));
    await list.expectRules({
      shown: [runTitle(run, 'Payments rule')],
      hidden: [runTitle(run, 'Unowned rule')],
    });
  });

  test('Folder adds folders one by one and each can be removed', async ({ page, folder, alertRules }) => {
    const run = newRunMarker();
    const otherFolder = await alertRules.createFolder(`Payments alerts ${run}`);
    await alertRules.seedRule(rule(run, 'Checkout latency high'));
    await alertRules.seedRule(rule(run, 'Disk space low', { folderUid: otherFolder.uid }));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.addFolder(folder.title);
    await list.expectRequestLeaf(filterLeaf('folder', 'In', [folder.uid]));
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high')],
      hidden: [runTitle(run, 'Disk space low')],
    });

    list.forgetRequests();
    await list.addFolder(otherFolder.title);
    await list.expectRequestLeaf(filterLeaf('folder', 'In', [folder.uid, otherFolder.uid]));
    await list.expectRules({ shown: [runTitle(run, 'Checkout latency high'), runTitle(run, 'Disk space low')] });

    list.forgetRequests();
    await list.removeSelectedValue(folder.title);
    await list.expectRequestLeaf(filterLeaf('folder', 'In', [otherFolder.uid]));
    await list.expectRules({
      shown: [runTitle(run, 'Disk space low')],
      hidden: [runTitle(run, 'Checkout latency high')],
    });
  });

  test('Query data source adds data sources one by one and each can be removed', async ({ page, alertRules }) => {
    const run = newRunMarker();
    await alertRules.seedRule(rule(run, 'Checkout latency high', { queryDataSourceUid: testDataSourceUid }));
    await alertRules.seedRule(rule(run, 'Disk space low', { queryDataSourceUid: prometheusDataSourceUid }));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.addDataSource('gdev-testdata');
    await list.expectRequestLeaf(filterLeaf('datasourceUIDs', 'In', [testDataSourceUid]));
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high')],
      hidden: [runTitle(run, 'Disk space low')],
    });

    list.forgetRequests();
    await list.addDataSource('gdev-prometheus');
    await list.expectRequestLeaf(filterLeaf('datasourceUIDs', 'In', [testDataSourceUid, prometheusDataSourceUid]));
    await list.expectRules({ shown: [runTitle(run, 'Checkout latency high'), runTitle(run, 'Disk space low')] });

    list.forgetRequests();
    await list.removeSelectedValue('gdev-testdata');
    await list.expectRequestLeaf(filterLeaf('datasourceUIDs', 'In', [prometheusDataSourceUid]));
    await list.expectRules({
      shown: [runTitle(run, 'Disk space low')],
      hidden: [runTitle(run, 'Checkout latency high')],
    });
  });

  test('Hide plugin rules removes plugin-owned rules', async ({ page, alertRules }) => {
    const run = newRunMarker();
    await alertRules.seedRule(rule(run, 'Checkout latency high'));
    await alertRules.seedRule(
      rule(run, 'Synthetic probe failing', { labels: { __grafana_origin: 'plugin/grafana-synthetic-monitoring-app' } })
    );

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    await list.expectRules({ shown: [runTitle(run, 'Synthetic probe failing')] });
    list.forgetRequests();
    await list.toggleHidePluginRules();

    await list.expectRequestLeaf({ regex: { field: 'labels', pattern: '__grafana_origin=plugin/.*', negate: true } });
    await list.expectSearchParam('plugins:hide');
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high')],
      hidden: [runTitle(run, 'Synthetic probe failing')],
    });
  });

  test('Dashboard limits rules to those linked to the picked dashboard', async ({ page, alertRules }) => {
    const run = newRunMarker();
    const dashboardTitle = `Checkout overview ${run}`;
    const dashboardUid = await alertRules.createDashboard(dashboardTitle, [4, 7]);
    await alertRules.seedRule(rule(run, 'Checkout latency high', { panel: { dashboardUid, panelId: 4 } }));
    await alertRules.seedRule(rule(run, 'Disk space low'));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.pickDashboard(dashboardTitle);

    await list.expectRequestLeaf(filterLeaf('dashboardUID', 'In', [dashboardUid]));
    await list.expectSearchParam(`dashboard:${dashboardUid}`);
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high')],
      hidden: [runTitle(run, 'Disk space low')],
    });
  });

  test('Panel ID narrows the picked dashboard to one panel', async ({ page, alertRules }) => {
    const run = newRunMarker();
    const dashboardUid = await alertRules.createDashboard(`Checkout overview ${run}`, [4, 7]);
    await alertRules.seedRule(rule(run, 'Checkout latency high', { panel: { dashboardUid, panelId: 4 } }));
    await alertRules.seedRule(rule(run, 'Checkout error rate', { panel: { dashboardUid, panelId: 7 } }));

    const list = new RuleListPage(page, 'alert');
    await list.goto(`${runScope(run)} dashboard:${dashboardUid}`);
    list.forgetRequests();
    await list.setPanelId(4);

    await list.expectRequestLeaf(filterLeaf('panelID', 'In', ['4']));
    await list.expectSearchParam('panelId:4');
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high')],
      hidden: [runTitle(run, 'Checkout error rate')],
    });
  });

  test('Contact point limits rules to those delivering to the picked contact point', async ({ page, alertRules }) => {
    const run = newRunMarker();
    const contactPointName = `payments-oncall-${run}`;
    await alertRules.createContactPoint(contactPointName);
    await alertRules.seedRule(rule(run, 'Checkout latency high', { receiver: contactPointName }));
    await alertRules.seedRule(rule(run, 'Disk space low'));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.pickContactPoint(contactPointName);

    await list.expectRequestLeaf(filterLeaf('receiver', 'In', [contactPointName]));
    await list.expectSearchParam(`contactPoint:${contactPointName}`);
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high')],
      hidden: [runTitle(run, 'Disk space low')],
    });
  });

  test('Notification policy limits rules to those routed through the picked policy', async ({ page, alertRules }) => {
    const run = newRunMarker();
    const policyName = `payments-policy-${run}`;
    await alertRules.createRoutingTree(policyName);
    await alertRules.seedRule(rule(run, 'Checkout latency high', { routingTree: policyName }));
    await alertRules.seedRule(rule(run, 'Disk space low'));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.pickPolicy(policyName);

    await list.expectRequestLeaf(filterLeaf('routingTree', 'In', [policyName]));
    await list.expectSearchParam(`policy:${policyName}`);
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high')],
      hidden: [runTitle(run, 'Disk space low')],
    });
  });

  test('Paused offers Paused and Not paused', async ({ page, alertRules }) => {
    const run = newRunMarker();
    await alertRules.seedRule(rule(run, 'Checkout latency high', { paused: true }));
    await alertRules.seedRule(rule(run, 'Disk space low', { paused: false }));

    const list = new RuleListPage(page, 'alert');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.chooseOption('Paused', 'Paused');
    await list.expectRequestLeaf(filterLeaf('paused', 'In', ['true']));
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency high')],
      hidden: [runTitle(run, 'Disk space low')],
    });

    list.forgetRequests();
    await list.chooseOption('Paused', 'Not paused');
    await list.expectRequestLeaf(filterLeaf('paused', 'In', ['false']));
    await list.expectRules({
      shown: [runTitle(run, 'Disk space low')],
      hidden: [runTitle(run, 'Checkout latency high')],
    });
  });
});
