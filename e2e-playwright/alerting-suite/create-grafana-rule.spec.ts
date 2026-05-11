import { test, expect } from '@grafana/plugin-e2e';

import { AlertRuleEditPage } from './pages/AlertRuleEditPage';
import { AlertRuleViewPage } from './pages/AlertRuleViewPage';

// Run serially: the three tests share one folder seeded in beforeAll. Running
// them across parallel workers leads to colliding folder titles (Date.now() can
// match) and double cleanup races against the same UID.
test.describe.configure({ mode: 'serial' });

const features = ['alerting.rulesAPIV2'];
const SUFFIX = Date.now();
const folderTitle = `E2E Alert Folder ${SUFFIX}`;
// "empty" is the default contact point Grafana provisions on a fresh dev install
// (spec.title === "empty"). Tests with their own Alertmanager config can override.
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
    await editor.goto({ features });

    await editor.createUngroupedGrafanaRule({
      name: ruleName,
      folder: folderTitle,
      interval: '1m',
      contactPoint,
      dataSource,
    });

    await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
    const viewer = new AlertRuleViewPage(page);
    await viewer.waitForLoad();
    await expect(viewer.nameHeading).toHaveText(ruleName);
    await expect(viewer.evaluationIntervalText).toBeVisible();
    await expect(viewer.contactPointLink(contactPoint)).toBeVisible();
  });

  test('saves a rule by creating a new evaluation group via the modal', async ({ page }) => {
    const editor = new AlertRuleEditPage(page);
    await editor.goto({ features });

    const ruleName = `E2E new-group ${SUFFIX}`;
    const groupName = `e2e-group-${SUFFIX}`;

    await editor.setName(ruleName);
    await editor.selectQueryDataSource(dataSource);
    await editor.selectFolder(folderTitle);
    await editor.createNewEvaluationGroup(groupName, '1m');
    await editor.setManualRouting(contactPoint);
    await editor.save();

    await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
    const viewer = new AlertRuleViewPage(page);
    await viewer.waitForLoad();
    await expect(viewer.nameHeading).toHaveText(ruleName);
    await expect(viewer.evaluationIntervalText).toBeVisible();
    await expect(viewer.contactPointLink(contactPoint)).toBeVisible();
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
      await editor.goto({ features });
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
      const editor = new AlertRuleEditPage(page);
      await editor.goto({ features });

      const ruleName = `E2E existing-group ${SUFFIX}`;
      await editor.setName(ruleName);
      await editor.selectQueryDataSource(dataSource);
      await editor.selectFolder(folderTitle);
      await editor.useExistingGroup(existingGroup);
      await editor.setManualRouting(contactPoint);
      await editor.save();

      await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
      const viewer = new AlertRuleViewPage(page);
      await viewer.waitForLoad();
      await expect(viewer.nameHeading).toHaveText(ruleName);
      await expect(viewer.evaluationIntervalText).toBeVisible();
      await expect(viewer.contactPointLink(contactPoint)).toBeVisible();
    });
  });
});
