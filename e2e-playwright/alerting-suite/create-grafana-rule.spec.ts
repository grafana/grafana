import { test, expect, contactPoint, dataSource, ruleUidFromUrl } from './fixtures';
import { AlertRuleEditPage } from './pages/AlertRuleEditPage';
import { AlertRuleViewPage } from './pages/AlertRuleViewPage';

// These tests run in parallel across workers. The worker-scoped `folder` fixture (see
// fixtures.ts) creates one folder per worker and reuses it, so folder writes stay at one
// per worker instead of one per test — that's what keeps the 2-connection SQLite pool from
// saturating and returning SQLITE_BUSY, which previously forced this file to run serially.
test.use({
  featureToggles: {
    'alerting.rulesAPIV2': true,
  },
});

test.describe('Grafana-managed alert rule creation', () => {
  test('saves a rule with a rule-based evaluation interval', async ({ page, folder, alertRules }) => {
    const ruleName = 'High CPU usage';
    const editor = new AlertRuleEditPage(page);
    await editor.goto();

    await editor.setName(ruleName);
    await editor.selectQueryDataSource(dataSource);
    await editor.selectFolder(folder.title);
    await editor.setEvaluationInterval('7m');
    await editor.setPendingPeriod('14m');
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
    await expect(viewer.evaluationIntervalText).toHaveText('Every 7m');
    await expect(viewer.pendingPeriodValue).toHaveText('14m');
    await expect(viewer.contactPointLink(contactPoint)).toBeVisible();
    await expect(viewer.label('team', 'e2e')).toBeVisible();
    await expect(viewer.annotationValue('summary')).toContainText(`${ruleName} summary`);
  });

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

  // Verifies the rule viewer renders persisted data correctly for a rule seeded via the
  // k8s-style alertrule API (independent of the UI create form).
  test.describe('with a pre-seeded rule-based interval rule', () => {
    const seededRuleName = 'Node load average';
    let seededRuleUid: string;

    test.beforeEach(async ({ alertRules }) => {
      seededRuleUid = await alertRules.seedRule({ title: seededRuleName, interval: '1m' });
    });

    test('edits a pre-existing rule-based interval rule and verifies the viewer', async ({ page, folder }) => {
      const updatedName = `${seededRuleName} edited`;
      const editor = new AlertRuleEditPage(page);
      await editor.gotoEdit(seededRuleUid);

      await editor.setName(updatedName);
      await editor.saveAndWaitForSuccess('updated');

      await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
      const viewer = new AlertRuleViewPage(page);
      await viewer.waitForLoad();
      await expect(viewer.nameHeading).toHaveText(updatedName);
      await expect(viewer.breadcrumbLink(folder.title)).toBeVisible();
      await expect(viewer.evaluationIntervalText).toBeVisible();
      await expect(viewer.contactPointLink(contactPoint)).toBeVisible();
    });
  });

  // Toggling between `Set interval` and `Use groups` clears the selected group on the way out
  // and restores it on the way back via `lastSelectedGroup` (GrafanaEvaluationBehavior.tsx:211-222,
  // L246-261). This test checks the round-trip is observable both in the form and after save.
  test.describe('with a pre-seeded evaluation group for mode toggle', () => {
    const seededGroup = 'platform-alerts';

    test.beforeEach(async ({ alertRules }) => {
      await alertRules.seedGroup(seededGroup, '1m', 'Pod restart rate');
    });

    test('switching evaluation mode round-trip restores the previously selected group', async ({
      page,
      folder,
      alertRules,
    }) => {
      const ruleName = 'Service availability';
      const editor = new AlertRuleEditPage(page);
      await editor.goto();

      await editor.setName(ruleName);
      await editor.selectQueryDataSource(dataSource);
      await editor.selectFolder(folder.title);
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
      await editor.saveAndWaitForSuccess('created');

      // The restored selection actually persists — viewer shows the group breadcrumb.
      await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
      alertRules.trackRule(ruleUidFromUrl(page.url()));
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

  // `forValidationOptions` (GrafanaEvaluationBehavior.tsx:105-143) blocks save when the pending
  // period is shorter than the evaluation interval. Verify the error surfaces and save is blocked.
  test('shows a validation error when pending period is shorter than the evaluation interval', async ({
    page,
    folder,
  }) => {
    const editor = new AlertRuleEditPage(page);
    await editor.goto();

    await editor.setName('Error rate');
    await editor.selectQueryDataSource(dataSource);
    await editor.selectFolder(folder.title);

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
