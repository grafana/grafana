import { test, expect, contactPoint, dataSource, ruleUidFromUrl } from './fixtures';
import { AlertRuleEditPage } from './pages/AlertRuleEditPage';
import { AlertRuleViewPage } from './pages/AlertRuleViewPage';

// These tests run in parallel across workers. The worker-scoped `folder` fixture (see
// fixtures.ts) creates one folder per worker and reuses it, so folder writes stay at one
// per worker instead of one per test — that's what keeps the 2-connection SQLite pool from
// saturating and returning SQLITE_BUSY, which previously forced this file to run serially.
test.describe('Grafana-managed alert rule creation', () => {
  test('saves a rule by creating a new evaluation group via the modal', async ({ page, folder, alertRules }) => {
    const ruleName = 'Disk space low';
    const groupName = 'disk-alerts';
    const editor = new AlertRuleEditPage(page);
    await editor.goto();

    await editor.setName(ruleName);
    await editor.selectQueryDataSource(dataSource);
    await editor.selectFolder(folder.title);
    await editor.createNewEvaluationGroup(groupName, '1m');
    await editor.addLabel('team', 'e2e');
    await editor.setAnnotations({ summary: `${ruleName} summary` });
    await editor.setManualRouting(contactPoint);
    await editor.saveAndWaitForSuccess('created');

    await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
    alertRules.trackRule(ruleUidFromUrl(page.url()));
    const viewer = new AlertRuleViewPage(page);
    await viewer.waitForLoad();
    await expect(viewer.nameHeading).toHaveText(ruleName);
    await expect(viewer.breadcrumbLink(folder.title)).toBeVisible();
    await expect(viewer.breadcrumbLink(groupName)).toBeVisible();
    await expect(viewer.evaluationIntervalText).toBeVisible();
    await expect(viewer.contactPointLink(contactPoint)).toBeVisible();
    await expect(viewer.label('team', 'e2e')).toBeVisible();
    await expect(viewer.annotationValue('summary')).toContainText(`${ruleName} summary`);
  });

  // The "existing group" scenario depends on a group already living in the folder.
  // We seed it through the ruler API so the test itself only exercises the "pick existing" path.
  test.describe('with a pre-seeded evaluation group', () => {
    const existingGroup = 'infra-monitoring';

    test.beforeEach(async ({ alertRules }) => {
      await alertRules.seedGroup(existingGroup, '1m', 'Node disk read latency');
    });

    test('saves a rule into an existing evaluation group', async ({ page, folder, alertRules }) => {
      const ruleName = 'Memory pressure';
      const editor = new AlertRuleEditPage(page);
      await editor.goto();

      await editor.setName(ruleName);
      await editor.selectQueryDataSource(dataSource);
      await editor.selectFolder(folder.title);
      await editor.useExistingGroup(existingGroup);
      await editor.addLabel('team', 'e2e');
      await editor.setAnnotations({ summary: `${ruleName} summary` });
      await editor.setManualRouting(contactPoint);
      await editor.saveAndWaitForSuccess('created');

      await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
      alertRules.trackRule(ruleUidFromUrl(page.url()));
      const viewer = new AlertRuleViewPage(page);
      await viewer.waitForLoad();
      await expect(viewer.nameHeading).toHaveText(ruleName);
      await expect(viewer.breadcrumbLink(folder.title)).toBeVisible();
      await expect(viewer.breadcrumbLink(existingGroup)).toBeVisible();
      await expect(viewer.evaluationIntervalText).toBeVisible();
      await expect(viewer.contactPointLink(contactPoint)).toBeVisible();
      await expect(viewer.label('team', 'e2e')).toBeVisible();
      await expect(viewer.annotationValue('summary')).toContainText(`${ruleName} summary`);
    });
  });

  // Picking an existing group auto-syncs `evaluateEvery` (GrafanaEvaluationBehavior.tsx:202-206).
  // The form-side helper text "All rules in the selected group are evaluated every X" is the
  // user-visible signal. We verify it updates when switching between groups with different intervals.
  test.describe('with two pre-seeded evaluation groups', () => {
    const group1m = 'frontend-alerts';
    const group5m = 'backend-alerts';

    test.beforeEach(async ({ alertRules }) => {
      await alertRules.seedGroup(group1m, '1m', 'HTTP error rate');
      await alertRules.seedGroup(group5m, '5m', 'Database query time');
    });

    test('switching the selected group updates the displayed evaluation interval text', async ({ page, folder }) => {
      const editor = new AlertRuleEditPage(page);
      await editor.goto();

      await editor.setName('Request timeout');
      await editor.selectQueryDataSource(dataSource);
      await editor.selectFolder(folder.title);

      await editor.useExistingGroup(group5m);
      await expect(editor.groupIntervalHelperText('5m')).toBeVisible();

      await editor.useExistingGroup(group1m);
      await expect(editor.groupIntervalHelperText('1m')).toBeVisible();
      await expect(editor.groupIntervalHelperText('5m')).toBeHidden();
    });
  });

  // Creating a new group through the modal auto-bumps the pending period up to the new
  // interval when the previous value was shorter (GrafanaEvaluationBehavior.tsx:224-237).
  test('creating a new evaluation group bumps pending period to the new interval when shorter', async ({
    page,
    folder,
    alertRules,
  }) => {
    const ruleName = 'Latency spike';
    const newGroup = 'latency-alerts';
    const editor = new AlertRuleEditPage(page);
    await editor.goto();

    await editor.setName(ruleName);
    await editor.selectQueryDataSource(dataSource);
    await editor.selectFolder(folder.title);

    // Pending period must be < the new group interval to trigger the bump.
    await editor.setPendingPeriod('30s');
    await editor.createNewEvaluationGroup(newGroup, '5m');

    await editor.setManualRouting(contactPoint);
    await editor.saveAndWaitForSuccess('created');

    await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
    alertRules.trackRule(ruleUidFromUrl(page.url()));
    const viewer = new AlertRuleViewPage(page);
    await viewer.waitForLoad();
    await expect(viewer.pendingPeriodValue).toHaveText('5m');
  });
});
