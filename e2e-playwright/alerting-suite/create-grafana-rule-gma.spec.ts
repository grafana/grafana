import { test, expect, contactPoint, dataSource, ruleUidFromUrl } from './fixtures';
import { AlertRuleEditPage } from './pages/AlertRuleEditPage';
import { AlertRuleViewPage } from './pages/AlertRuleViewPage';

// These tests run in parallel across workers. The worker-scoped `folder` fixture (see
// fixtures.ts) creates one folder per worker and reuses it, so folder writes stay at one
// per worker instead of one per test — that's what keeps the 2-connection SQLite pool from
// saturating and returning SQLITE_BUSY, which previously forced this file to run serially.
test.use({
  openFeature: { flags: { 'alerting.gmaOnlyListView': true } },
});

test.describe('Grafana-managed alert rule creation with alerting.gmaOnlyListView', () => {
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
