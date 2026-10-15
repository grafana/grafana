import { test } from './fixtures';
import { LABEL_RULES, labelFilterCases } from './labelFilterCases';
import { RuleListPage, filterLeaf } from './pages/RuleListPage';
import {
  RUN_LABEL,
  type RecordingRuleSeed,
  newRunMarker,
  prometheusDataSourceUid,
  recordingMetricFor,
  runScope,
  runTitle,
  testDataSourceUid,
} from './ruleSeeding';

// Same approach as gma-alert-filters.spec.ts: each journey seeds its own run-labelled rules, scopes
// the list to them, applies one filter as a user does, and checks the /recordingrules/searchRules
// request body and the rules shown.
function rule(run: string, name: string, extra: Partial<RecordingRuleSeed> = {}): RecordingRuleSeed {
  return {
    metric: recordingMetricFor(run, name),
    ...extra,
    title: runTitle(run, name),
    labels: { [RUN_LABEL]: run, ...extra.labels },
  };
}

test.describe('Recording rules: token filters', () => {
  test('SEARCH-3: rule: matches rule titles', async ({ page, recordingRules }) => {
    const run = newRunMarker();
    await recordingRules.seedRule(rule(run, 'Checkout latency p99'));
    await recordingRules.seedRule(rule(run, 'Disk usage ratio'));

    const list = new RuleListPage(page, 'recording');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.search(`${runScope(run)} rule:latency`);

    await list.expectRequestLeaf({ text: { value: 'latency' } });
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency p99')],
      hidden: [runTitle(run, 'Disk usage ratio')],
    });
  });

  test('SEARCH-3: namespace: limits rules to the folder', async ({ page, folder, recordingRules }) => {
    const run = newRunMarker();
    const otherFolder = await recordingRules.createFolder(`Payments rules ${run}`);
    await recordingRules.seedRule(rule(run, 'Checkout latency p99'));
    await recordingRules.seedRule(rule(run, 'Disk usage ratio', { folderUid: otherFolder.uid }));

    const list = new RuleListPage(page, 'recording');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.search(`${runScope(run)} namespace:${folder.uid}`);

    await list.expectRequestLeaf(filterLeaf('folder', 'In', [folder.uid]));
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency p99')],
      hidden: [runTitle(run, 'Disk usage ratio')],
    });
  });

  test('SEARCH-3: datasource: limits rules to those querying the data source', async ({ page, recordingRules }) => {
    const run = newRunMarker();
    await recordingRules.seedRule(rule(run, 'Checkout latency p99', { queryDataSourceUid: testDataSourceUid }));
    await recordingRules.seedRule(rule(run, 'Disk usage ratio', { queryDataSourceUid: prometheusDataSourceUid }));
    await recordingRules.seedRule(rule(run, 'Memory usage ratio'));

    const list = new RuleListPage(page, 'recording');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.search(`${runScope(run)} datasource:${testDataSourceUid}`);

    await list.expectRequestLeaf(filterLeaf('datasourceUIDs', 'In', [testDataSourceUid]));
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency p99')],
      hidden: [runTitle(run, 'Disk usage ratio'), runTitle(run, 'Memory usage ratio')],
    });
  });

  for (const { operator, token, leaf, shown, hidden } of labelFilterCases) {
    test(`SEARCH-3: ${token} finds rules whose team label ${operator}`, async ({ page, recordingRules }) => {
      const run = newRunMarker();
      await recordingRules.seedRule(rule(run, LABEL_RULES.payments, { labels: { team: 'payments' } }));
      await recordingRules.seedRule(rule(run, LABEL_RULES.checkout, { labels: { team: 'checkout' } }));
      await recordingRules.seedRule(rule(run, LABEL_RULES.unowned));

      const list = new RuleListPage(page, 'recording');
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

  test('SEARCH-3: plugins:hide removes rules owned by a plugin and keeps other origins', async ({
    page,
    recordingRules,
  }) => {
    const run = newRunMarker();
    await recordingRules.seedRule(rule(run, 'Checkout latency p99'));
    await recordingRules.seedRule(
      rule(run, 'Synthetic probe duration', { labels: { __grafana_origin: 'plugin/grafana-synthetic-monitoring-app' } })
    );
    await recordingRules.seedRule(rule(run, 'Imported usage ratio', { labels: { __grafana_origin: 'migration' } }));

    const list = new RuleListPage(page, 'recording');
    await list.goto(runScope(run));
    await list.expectRules({ shown: [runTitle(run, 'Synthetic probe duration')] });
    list.forgetRequests();
    await list.search(`${runScope(run)} plugins:hide`);

    await list.expectRequestLeaf({ regex: { field: 'labels', pattern: '__grafana_origin=plugin/.*', negate: true } });
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency p99'), runTitle(run, 'Imported usage ratio')],
      hidden: [runTitle(run, 'Synthetic probe duration')],
    });
  });

  test('SEARCH-4: metric: limits rules to the exact recorded metric', async ({ page, recordingRules }) => {
    const run = newRunMarker();
    const metric = recordingMetricFor(run, 'Checkout latency p99');
    await recordingRules.seedRule(rule(run, 'Checkout latency p99'));
    await recordingRules.seedRule(rule(run, 'Disk usage ratio'));

    const list = new RuleListPage(page, 'recording');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.search(`${runScope(run)} metric:${metric}`);

    await list.expectRequestLeaf(filterLeaf('metric', 'In', [metric]));
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency p99')],
      hidden: [runTitle(run, 'Disk usage ratio')],
    });
  });

  test('SEARCH-4: targetDatasource: limits rules to those writing to the data source', async ({
    page,
    recordingRules,
  }) => {
    const run = newRunMarker();
    await recordingRules.seedRule(rule(run, 'Checkout latency p99', { targetDataSourceUid: prometheusDataSourceUid }));
    await recordingRules.seedRule(rule(run, 'Disk usage ratio'));

    const list = new RuleListPage(page, 'recording');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.search(`${runScope(run)} targetDatasource:${prometheusDataSourceUid}`);

    await list.expectRequestLeaf(filterLeaf('targetDatasourceUID', 'In', [prometheusDataSourceUid]));
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency p99')],
      hidden: [runTitle(run, 'Disk usage ratio')],
    });
  });
});

test.describe('Recording rules: sidebar filters', () => {
  test('SEARCH-3: Rule name filters by title', async ({ page, recordingRules }) => {
    const run = newRunMarker();
    await recordingRules.seedRule(rule(run, 'Checkout latency p99'));
    await recordingRules.seedRule(rule(run, 'Disk usage ratio'));

    const list = new RuleListPage(page, 'recording');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.setRuleName('latency');

    await list.expectRequestLeaf({ text: { value: 'latency' } });
    await list.expectSearchParam('latency');
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency p99')],
      hidden: [runTitle(run, 'Disk usage ratio')],
    });
  });

  test('SEARCH-3: Add label filter applies a key and value matcher', async ({ page, recordingRules }) => {
    const run = newRunMarker();
    await recordingRules.seedRule(rule(run, LABEL_RULES.payments, { labels: { team: 'payments' } }));
    await recordingRules.seedRule(rule(run, LABEL_RULES.checkout, { labels: { team: 'checkout' } }));

    const list = new RuleListPage(page, 'recording');
    await list.goto(runScope(run));
    await list.addLabelFilter({ key: 'team', value: 'payments' });

    await list.expectRequestLeaf(filterLeaf('labels', 'In', ['team=payments']));
    await list.expectSearchParam('label:team=payments');
    await list.expectRules({
      shown: [runTitle(run, LABEL_RULES.payments)],
      hidden: [runTitle(run, LABEL_RULES.checkout)],
    });
  });

  test('SEARCH-3: Folder adds folders one by one and each can be removed', async ({ page, folder, recordingRules }) => {
    const run = newRunMarker();
    const otherFolder = await recordingRules.createFolder(`Payments rules ${run}`);
    await recordingRules.seedRule(rule(run, 'Checkout latency p99'));
    await recordingRules.seedRule(rule(run, 'Disk usage ratio', { folderUid: otherFolder.uid }));

    const list = new RuleListPage(page, 'recording');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.addFolder(folder.title);
    await list.expectRequestLeaf(filterLeaf('folder', 'In', [folder.uid]));
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency p99')],
      hidden: [runTitle(run, 'Disk usage ratio')],
    });

    list.forgetRequests();
    await list.addFolder(otherFolder.title);
    await list.expectRequestLeaf(filterLeaf('folder', 'In', [folder.uid, otherFolder.uid]));
    await list.expectRules({ shown: [runTitle(run, 'Checkout latency p99'), runTitle(run, 'Disk usage ratio')] });

    list.forgetRequests();
    await list.removeSelectedValue(folder.title);
    await list.expectRequestLeaf(filterLeaf('folder', 'In', [otherFolder.uid]));
    await list.expectRules({
      shown: [runTitle(run, 'Disk usage ratio')],
      hidden: [runTitle(run, 'Checkout latency p99')],
    });
  });

  test('SEARCH-3: Query data source adds data sources one by one and each can be removed', async ({
    page,
    recordingRules,
  }) => {
    const run = newRunMarker();
    await recordingRules.seedRule(rule(run, 'Checkout latency p99', { queryDataSourceUid: testDataSourceUid }));
    await recordingRules.seedRule(rule(run, 'Disk usage ratio', { queryDataSourceUid: prometheusDataSourceUid }));

    const list = new RuleListPage(page, 'recording');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.addDataSource('gdev-testdata');
    await list.expectRequestLeaf(filterLeaf('datasourceUIDs', 'In', [testDataSourceUid]));
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency p99')],
      hidden: [runTitle(run, 'Disk usage ratio')],
    });

    list.forgetRequests();
    await list.addDataSource('gdev-prometheus');
    await list.expectRequestLeaf(filterLeaf('datasourceUIDs', 'In', [testDataSourceUid, prometheusDataSourceUid]));
    await list.expectRules({ shown: [runTitle(run, 'Checkout latency p99'), runTitle(run, 'Disk usage ratio')] });

    list.forgetRequests();
    await list.removeSelectedValue('gdev-testdata');
    await list.expectRequestLeaf(filterLeaf('datasourceUIDs', 'In', [prometheusDataSourceUid]));
    await list.expectRules({
      shown: [runTitle(run, 'Disk usage ratio')],
      hidden: [runTitle(run, 'Checkout latency p99')],
    });
  });

  test('SEARCH-3: Hide plugin rules removes plugin-owned rules', async ({ page, recordingRules }) => {
    const run = newRunMarker();
    await recordingRules.seedRule(rule(run, 'Checkout latency p99'));
    await recordingRules.seedRule(
      rule(run, 'Synthetic probe duration', { labels: { __grafana_origin: 'plugin/grafana-synthetic-monitoring-app' } })
    );

    const list = new RuleListPage(page, 'recording');
    await list.goto(runScope(run));
    await list.expectRules({ shown: [runTitle(run, 'Synthetic probe duration')] });
    list.forgetRequests();
    await list.toggleHidePluginRules();

    await list.expectRequestLeaf({ regex: { field: 'labels', pattern: '__grafana_origin=plugin/.*', negate: true } });
    await list.expectSearchParam('plugins:hide');
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency p99')],
      hidden: [runTitle(run, 'Synthetic probe duration')],
    });
  });

  test('SEARCH-4: Recorded metric limits rules to the exact metric', async ({ page, recordingRules }) => {
    const run = newRunMarker();
    const metric = recordingMetricFor(run, 'Checkout latency p99');
    await recordingRules.seedRule(rule(run, 'Checkout latency p99'));
    await recordingRules.seedRule(rule(run, 'Disk usage ratio'));

    const list = new RuleListPage(page, 'recording');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.setRecordedMetric(metric);

    await list.expectRequestLeaf(filterLeaf('metric', 'In', [metric]));
    await list.expectSearchParam(`metric:${metric}`);
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency p99')],
      hidden: [runTitle(run, 'Disk usage ratio')],
    });
  });

  test('SEARCH-4: Target data source limits rules to those writing to the picked data source', async ({
    page,
    recordingRules,
  }) => {
    const run = newRunMarker();
    await recordingRules.seedRule(rule(run, 'Checkout latency p99', { targetDataSourceUid: prometheusDataSourceUid }));
    await recordingRules.seedRule(rule(run, 'Disk usage ratio'));

    const list = new RuleListPage(page, 'recording');
    await list.goto(runScope(run));
    list.forgetRequests();
    await list.addDataSource('gdev-prometheus', 'Target data source');

    await list.expectRequestLeaf(filterLeaf('targetDatasourceUID', 'In', [prometheusDataSourceUid]));
    await list.expectSearchParam(`targetDatasource:${prometheusDataSourceUid}`);
    await list.expectRules({
      shown: [runTitle(run, 'Checkout latency p99')],
      hidden: [runTitle(run, 'Disk usage ratio')],
    });
  });
});
