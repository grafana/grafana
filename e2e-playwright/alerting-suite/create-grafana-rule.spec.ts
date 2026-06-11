import { type APIRequestContext } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

import { AlertRuleEditPage } from './pages/AlertRuleEditPage';
import { AlertRuleViewPage } from './pages/AlertRuleViewPage';

// All tests in this file share the same SQLite-backed Grafana instance.
// Running them serially (one worker) prevents concurrent beforeEach folder
// writes from saturating the 2-connection pool and returning SQLITE_BUSY.
test.describe.configure({ mode: 'serial' });

test.use({
  featureToggles: {
    'alerting.rulesAPIV2': true,
  },
});

// "empty" is the default contact point Grafana provisions on a fresh dev install.
const contactPoint = 'empty';
const dataSource = 'gdev-testdata';

// Each test gets its own folder with a per-invocation unique title so parallel workers
// never collide and orphans from crashed runs don't accumulate. Assigned in beforeEach.
let folderTitle: string;
let folderUid: string;
let dataSourceUid: string;

test.beforeEach(async ({ request }) => {
  folderTitle = `Infrastructure alerts ${crypto.randomUUID().slice(0, 8)}`;

  // Retry folder creation to handle transient SQLite-busy / connection-pool errors that can
  // occur under the parallelism of CI (4 workers, SQLite max_open_conn cap).
  await expect
    .poll(async () => {
      const res = await request.post('/api/folders', { data: { title: folderTitle } });
      if (!res.ok()) {
        throw new Error(`POST /api/folders failed: ${res.status()} ${await res.text()}`);
      }
      folderUid = (await res.json()).uid;
      return folderUid;
    })
    .toBeTruthy();

  // Ruler API needs the datasource UID, not its name — the UI form resolves this via the
  // datasource picker. We mirror that lookup here so seeds work regardless of how the
  // dev env provisions the gdev datasources.
  const dsResponse = await request.get(`/api/datasources/name/${encodeURIComponent(dataSource)}`);
  expect(dsResponse.ok()).toBeTruthy();
  dataSourceUid = (await dsResponse.json()).uid;
});

test.afterEach(async ({ request }) => {
  if (folderUid) {
    await request.delete(`/api/folders/${folderUid}?forceDeleteRules=true`);
    folderUid = '';
  }
});

test.describe('Grafana-managed alert rule creation', () => {
  test('saves a rule with a rule-based evaluation interval', async ({ page }) => {
    const ruleName = 'High CPU usage';
    const editor = new AlertRuleEditPage(page);
    await editor.goto();

    await editor.setName(ruleName);
    await editor.selectQueryDataSource(dataSource);
    await editor.selectFolder(folderTitle);
    await editor.setEvaluationInterval('7m');
    await editor.setPendingPeriod('14m');
    await editor.addLabel('team', 'e2e');
    await editor.setAnnotations({ summary: `${ruleName} summary` });
    await editor.setManualRouting(contactPoint);
    await editor.save();

    await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
    const viewer = new AlertRuleViewPage(page);
    await viewer.waitForLoad();
    await expect(viewer.nameHeading).toHaveText(ruleName);
    await expect(viewer.breadcrumbLink(folderTitle)).toBeVisible();
    await expect(viewer.evaluationIntervalText).toHaveText('Every 7m');
    await expect(viewer.pendingPeriodValue).toHaveText('14m');
    await expect(viewer.contactPointLink(contactPoint)).toBeVisible();
    await expect(viewer.label('team', 'e2e')).toBeVisible();
    await expect(viewer.annotationValue('summary')).toContainText(`${ruleName} summary`);
  });

  test('saves a rule by creating a new evaluation group via the modal', async ({ page }) => {
    const ruleName = 'Disk space low';
    const groupName = 'disk-alerts';
    const editor = new AlertRuleEditPage(page);
    await editor.goto();

    await editor.setName(ruleName);
    await editor.selectQueryDataSource(dataSource);
    await editor.selectFolder(folderTitle);
    await editor.createNewEvaluationGroup(groupName, '1m');
    await editor.addLabel('team', 'e2e');
    await editor.setAnnotations({ summary: `${ruleName} summary` });
    await editor.setManualRouting(contactPoint);
    await editor.save();

    await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
    const viewer = new AlertRuleViewPage(page);
    await viewer.waitForLoad();
    await expect(viewer.nameHeading).toHaveText(ruleName);
    await expect(viewer.breadcrumbLink(folderTitle)).toBeVisible();
    await expect(viewer.breadcrumbLink(groupName)).toBeVisible();
    await expect(viewer.evaluationIntervalText).toBeVisible();
    await expect(viewer.contactPointLink(contactPoint)).toBeVisible();
    await expect(viewer.label('team', 'e2e')).toBeVisible();
    await expect(viewer.annotationValue('summary')).toContainText(`${ruleName} summary`);
  });

  // The "existing group" scenario depends on a group already living in the folder.
  // We seed it through the ruler API so the test itself only exercises the
  // "pick existing" path. Cleanup is handled by the folder delete in afterEach
  // (`forceDeleteRules=true`).
  test.describe('with a pre-seeded evaluation group', () => {
    const existingGroup = 'infra-monitoring';

    test.beforeEach(async ({ request }) => {
      await seedRuleGroup(request, folderUid, existingGroup, '1m', dataSourceUid, 'Node disk read latency');
    });

    test('saves a rule into an existing evaluation group', async ({ page }) => {
      const ruleName = 'Memory pressure';
      const editor = new AlertRuleEditPage(page);
      await editor.goto();

      await editor.setName(ruleName);
      await editor.selectQueryDataSource(dataSource);
      await editor.selectFolder(folderTitle);
      await editor.useExistingGroup(existingGroup);
      await editor.addLabel('team', 'e2e');
      await editor.setAnnotations({ summary: `${ruleName} summary` });
      await editor.setManualRouting(contactPoint);
      await editor.save();

      await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
      const viewer = new AlertRuleViewPage(page);
      await viewer.waitForLoad();
      await expect(viewer.nameHeading).toHaveText(ruleName);
      await expect(viewer.breadcrumbLink(folderTitle)).toBeVisible();
      await expect(viewer.breadcrumbLink(existingGroup)).toBeVisible();
      await expect(viewer.evaluationIntervalText).toBeVisible();
      await expect(viewer.contactPointLink(contactPoint)).toBeVisible();
      await expect(viewer.label('team', 'e2e')).toBeVisible();
      await expect(viewer.annotationValue('summary')).toContainText(`${ruleName} summary`);
    });
  });

  // Verifies the rule viewer renders persisted data correctly for a rule seeded via the
  // k8s-style alertrule API (independent of the UI create form).
  test.describe('with a pre-seeded rule-based interval rule', () => {
    const seededRuleName = 'Node load average';
    let seededRuleUid: string;

    test.beforeEach(async ({ request }) => {
      // Resolve the k8s namespace from the Grafana boot config, the same way the
      // frontend does (getAPINamespace → config.namespace).
      const settings = await request.get('/api/frontend/settings');
      const { namespace } = await settings.json();

      const data = {
        apiVersion: 'rules.alerting.grafana.app/v0alpha1',
        kind: 'AlertRule',
        metadata: { annotations: { 'grafana.app/folder': folderUid } },
        spec: {
          title: seededRuleName,
          trigger: { interval: '1m' },
          noDataState: 'NoData',
          execErrState: 'Error',
          notificationSettings: { type: 'SimplifiedRouting', receiver: contactPoint },
          expressions: {
            A: {
              model: {
                datasource: { type: 'grafana-testdata-datasource', uid: dataSourceUid },
                refId: 'A',
                scenarioId: 'random_walk',
              },
              datasourceUID: dataSourceUid,
              queryType: '',
              relativeTimeRange: { from: '10m', to: '0' },
              source: false,
            },
            B: {
              model: { type: 'reduce', reducer: 'last', expression: 'A', refId: 'B' },
              datasourceUID: '__expr__',
              queryType: '',
              source: false,
            },
            C: {
              model: {
                type: 'threshold',
                expression: 'B',
                conditions: [{ evaluator: { type: 'gt', params: [0] } }],
                refId: 'C',
              },
              datasourceUID: '__expr__',
              queryType: '',
              source: true,
            },
          },
        },
      };
      await expect
        .poll(async () => {
          const res = await request.post(
            `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/${namespace}/alertrules`,
            { data }
          );
          if (!res.ok()) {
            throw new Error(`POST alertrules failed: ${res.status()} ${await res.text()}`);
          }
          seededRuleUid = (await res.json()).metadata.name;
          return seededRuleUid;
        })
        .toBeTruthy();
    });

    test('edits a pre-existing rule-based interval rule and verifies the viewer', async ({ page }) => {
      const updatedName = `${seededRuleName} edited`;
      const editor = new AlertRuleEditPage(page);
      await editor.gotoEdit(seededRuleUid);

      await editor.setName(updatedName);
      await editor.save();

      await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
      const viewer = new AlertRuleViewPage(page);
      await viewer.waitForLoad();
      await expect(viewer.nameHeading).toHaveText(updatedName);
      await expect(viewer.breadcrumbLink(folderTitle)).toBeVisible();
      await expect(viewer.evaluationIntervalText).toBeVisible();
      await expect(viewer.contactPointLink(contactPoint)).toBeVisible();
    });
  });

  // Toggling between `Set interval` and `Use groups` clears the selected group on the way out
  // and restores it on the way back via `lastSelectedGroup` (GrafanaEvaluationBehavior.tsx:211-222,
  // L246-261). This test checks the round-trip is observable both in the form and after save.
  test.describe('with a pre-seeded evaluation group for mode toggle', () => {
    const seededGroup = 'platform-alerts';

    test.beforeEach(async ({ request }) => {
      await seedRuleGroup(request, folderUid, seededGroup, '1m', dataSourceUid, 'Pod restart rate');
    });

    test('switching evaluation mode round-trip restores the previously selected group', async ({ page }) => {
      const ruleName = 'Service availability';
      const editor = new AlertRuleEditPage(page);
      await editor.goto();

      await editor.setName(ruleName);
      await editor.selectQueryDataSource(dataSource);
      await editor.selectFolder(folderTitle);
      await editor.useExistingGroup(seededGroup);

      // Switching to rule-based hides the group select and exposes the bare interval input.
      await editor.setEvaluationMode('rule-based');
      await expect(editor.evaluationModeRadio('rule-based')).toBeChecked();
      await expect(editor.ungroupedIntervalInput).toBeVisible();
      await expect(editor.groupSelect).toBeHidden();

      // Switching back restores the group via lastSelectedGroup. The selected value renders
      // as visible text inside the group picker.
      await editor.setEvaluationMode('group-based');
      await expect(editor.groupSelect).toBeVisible();
      await expect(editor.selectedGroupText(seededGroup)).toBeVisible();

      await editor.setManualRouting(contactPoint);
      await editor.save();

      // The restored selection actually persists — viewer shows the group breadcrumb.
      await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
      const viewer = new AlertRuleViewPage(page);
      await viewer.waitForLoad();
      await expect(viewer.breadcrumbLink(seededGroup)).toBeVisible();
    });
  });

  // Picking an existing group auto-syncs `evaluateEvery` (GrafanaEvaluationBehavior.tsx:202-206).
  // The form-side helper text "All rules in the selected group are evaluated every X" is the
  // user-visible signal. We verify it updates when switching between groups with different intervals.
  test.describe('with two pre-seeded evaluation groups', () => {
    const group1m = 'frontend-alerts';
    const group5m = 'backend-alerts';

    test.beforeEach(async ({ request }) => {
      await seedRuleGroup(request, folderUid, group1m, '1m', dataSourceUid, 'HTTP error rate');
      await seedRuleGroup(request, folderUid, group5m, '5m', dataSourceUid, 'Database query time');
    });

    test('switching the selected group updates the displayed evaluation interval text', async ({ page }) => {
      const editor = new AlertRuleEditPage(page);
      await editor.goto();

      await editor.setName('Request timeout');
      await editor.selectQueryDataSource(dataSource);
      await editor.selectFolder(folderTitle);

      await editor.useExistingGroup(group5m);
      await expect(editor.groupIntervalHelperText('5m')).toBeVisible();

      await editor.useExistingGroup(group1m);
      await expect(editor.groupIntervalHelperText('1m')).toBeVisible();
      await expect(editor.groupIntervalHelperText('5m')).toBeHidden();
    });
  });

  // Creating a new group through the modal auto-bumps the pending period up to the new
  // interval when the previous value was shorter (GrafanaEvaluationBehavior.tsx:224-237).
  test('creating a new evaluation group bumps pending period to the new interval when shorter', async ({ page }) => {
    const ruleName = 'Latency spike';
    const newGroup = 'latency-alerts';
    const editor = new AlertRuleEditPage(page);
    await editor.goto();

    await editor.setName(ruleName);
    await editor.selectQueryDataSource(dataSource);
    await editor.selectFolder(folderTitle);

    // Pending period must be < the new group interval to trigger the bump.
    await editor.setPendingPeriod('30s');
    await editor.createNewEvaluationGroup(newGroup, '5m');

    await editor.setManualRouting(contactPoint);
    await editor.save();

    await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
    const viewer = new AlertRuleViewPage(page);
    await viewer.waitForLoad();
    await expect(viewer.pendingPeriodValue).toHaveText('5m');
  });

  // `forValidationOptions` (GrafanaEvaluationBehavior.tsx:105-143) blocks save when the pending
  // period is shorter than the evaluation interval. Verify the error surfaces and save is blocked.
  test('shows a validation error when pending period is shorter than the evaluation interval', async ({ page }) => {
    const editor = new AlertRuleEditPage(page);
    await editor.goto();

    await editor.setName('Error rate');
    await editor.selectQueryDataSource(dataSource);
    await editor.selectFolder(folderTitle);

    await editor.setEvaluationInterval('5m');
    await editor.setPendingPeriod('30s');
    await editor.setManualRouting(contactPoint);
    await editor.save();

    await expect(
      page.getByText(/pending period must be greater than or equal to the evaluation interval/i)
    ).toBeVisible();
    await expect(page).toHaveURL(/\/alerting\/new/);
  });
});

// Seed a Grafana-managed evaluation group via the ruler API. Each group must contain
// at least one rule — we include a minimal placeholder. Cleanup is handled by the
// parent folder delete in afterEach (`forceDeleteRules=true`).
// Reference rule shape: public/app/features/alerting/unified/mocks/grafanaRulerApi.ts:33-73.
async function seedRuleGroup(
  request: APIRequestContext,
  folderUid: string,
  groupName: string,
  interval: string,
  dataSourceUid: string,
  ruleTitle: string
): Promise<void> {
  const response = await request.post(`/api/ruler/grafana/api/v1/rules/${folderUid}`, {
    data: {
      name: groupName,
      interval,
      rules: [
        {
          for: '0s',
          annotations: {},
          labels: {},
          grafana_alert: {
            title: ruleTitle,
            condition: 'A',
            no_data_state: 'NoData',
            exec_err_state: 'Error',
            data: [
              {
                refId: 'A',
                datasourceUid: dataSourceUid,
                queryType: '',
                relativeTimeRange: { from: 600, to: 0 },
                model: {
                  refId: 'A',
                  scenarioId: 'random_walk',
                  datasource: { type: 'grafana-testdata-datasource', uid: dataSourceUid },
                },
              },
            ],
          },
        },
      ],
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed rule group: ${response.status()} ${await response.text()}`);
  }
}
