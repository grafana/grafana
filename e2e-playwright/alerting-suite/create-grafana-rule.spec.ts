import { test, expect } from '@grafana/plugin-e2e';

import { AlertRuleEditPage } from './pages/AlertRuleEditPage';
import { AlertRuleViewPage } from './pages/AlertRuleViewPage';

// Run serially: tests share one folder seeded in beforeAll. Parallel workers lead to
// colliding folder titles (Date.now() can match) and cleanup races on the same UID.
test.describe.configure({ mode: 'serial' });

test.use({
  featureToggles: {
    'alerting.rulesAPIV2': true,
  },
});

const SUFFIX = Date.now();
const folderTitle = `E2E Alert Folder ${SUFFIX}`;
// "empty" is the default contact point Grafana provisions on a fresh dev install.
const contactPoint = 'empty';
const dataSource = 'gdev-testdata';

let folderUid: string;

test.beforeAll(async ({ request }) => {
  const response = await request.post('/api/folders', { data: { title: folderTitle } });
  expect(response.ok()).toBeTruthy();
  folderUid = (await response.json()).uid;
});

test.afterAll(async ({ request }) => {
  if (folderUid) {
    await request.delete(`/api/folders/${folderUid}?forceDeleteRules=true`);
  }
});

test.describe('Grafana-managed alert rule creation', () => {
  test('saves a rule with a rule-based evaluation interval', async ({ page }) => {
    const ruleName = `E2E rule-based ${SUFFIX}`;
    const editor = new AlertRuleEditPage(page);
    await editor.goto();

    await editor.setName(ruleName);
    await editor.selectQueryDataSource(dataSource);
    await editor.selectFolder(folderTitle);
    await editor.setEvaluationInterval('1m');
    await editor.addLabel('team', 'e2e');
    await editor.setAnnotations({ summary: `${ruleName} summary` });
    await editor.setManualRouting(contactPoint);
    await editor.save();

    await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
    const viewer = new AlertRuleViewPage(page);
    await viewer.waitForLoad();
    await expect(viewer.nameHeading).toHaveText(ruleName);
    await expect(viewer.breadcrumbLink(folderTitle)).toBeVisible();
    await expect(viewer.evaluationIntervalText).toBeVisible();
    await expect(viewer.contactPointLink(contactPoint)).toBeVisible();
    await expect(viewer.label('team', 'e2e')).toBeVisible();
    await expect(viewer.annotationValue('summary')).toContainText(`${ruleName} summary`);
  });

  test('saves a rule by creating a new evaluation group via the modal', async ({ page }) => {
    const ruleName = `E2E new-group ${SUFFIX}`;
    const groupName = `e2e-group-${SUFFIX}`;
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
  // We seed it through the UI in a separate browser context so the test itself only
  // exercises the "pick existing" path. Cleanup is handled by the folder delete in
  // afterAll (`forceDeleteRules=true`).
  test.describe('with a pre-seeded evaluation group', () => {
    const existingGroup = `e2e-existing-${SUFFIX}`;

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext({
        storageState: `playwright/.auth/${process.env.GRAFANA_ADMIN_USER || 'admin'}.json`,
      });
      const page = await context.newPage();
      const editor = new AlertRuleEditPage(page);
      await editor.goto();
      await editor.setName(`E2E seed ${SUFFIX}`);
      await editor.selectQueryDataSource(dataSource);
      await editor.selectFolder(folderTitle);
      await editor.createNewEvaluationGroup(existingGroup, '1m');
      await editor.setManualRouting(contactPoint);
      await editor.save();
      await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
      await context.close();
    });

    test('saves a rule into an existing evaluation group', async ({ page }) => {
      const ruleName = `E2E existing-group ${SUFFIX}`;
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
    const seededRuleName = `E2E seeded-rule-based ${SUFFIX}`;
    let seededRuleUid: string;

    test.beforeAll(async ({ request }) => {
      // Resolve the k8s namespace from the Grafana boot config, the same way the
      // frontend does (getAPINamespace → config.namespace).
      const settings = await request.get('/api/frontend/settings');
      const namespace = (await settings.json()).namespace as string;

      const response = await request.post(
        `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/${namespace}/alertrules`,
        {
          data: {
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
                    datasource: { type: 'grafana-testdata-datasource', uid: dataSource },
                    refId: 'A',
                    scenarioId: 'random_walk',
                  },
                  datasourceUID: dataSource,
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
          },
        }
      );
      expect(response.ok()).toBeTruthy();
      seededRuleUid = (await response.json()).metadata.name;
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
});
