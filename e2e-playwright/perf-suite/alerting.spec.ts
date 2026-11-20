import { contactPoint, dataSource, expect, ruleUidFromUrl, test } from '../alerting-suite/fixtures';
import { AlertRuleEditPage } from '../alerting-suite/pages/AlertRuleEditPage';

import { ITERATIONS, measure, setupPerf, waitForQuiet } from './perf';

const unique = () => crypto.randomUUID().slice(0, 8);

// Same toggle as the alerting suite's rule-creation tests, so the form flow matches theirs.
test.use({ featureToggles: { 'alerting.rulesAPIV2': true } });

test.describe('Perf: alerting', { tag: ['@perf'] }, () => {
  test('alert rules: list, create and edit', async ({ page, folder, alertRules }, testInfo) => {
    const cdp = await setupPerf(page);
    const editor = new AlertRuleEditPage(page);
    await alertRules.seedRule({ title: `Node disk read latency ${unique()}`, interval: '1m' });

    for (let i = 0; i < ITERATIONS; i++) {
      await measure(page, cdp, testInfo, 'alert rules: load list', async () => {
        await page.goto('/alerting/list');
        await page.getByText(folder.title).first().waitFor();
      });

      await measure(page, cdp, testInfo, 'alert rules: open new rule form', () => editor.goto());

      const ruleName = `High CPU usage ${unique()}`;
      await measure(page, cdp, testInfo, 'alert rules: fill in and save new rule', async () => {
        await editor.setName(ruleName);
        await editor.selectQueryDataSource(dataSource);
        await editor.selectFolder(folder.title);
        await editor.setEvaluationInterval('5m');
        await editor.setPendingPeriod('10m');
        await editor.addLabel('team', 'e2e');
        await editor.setAnnotations({ summary: `${ruleName} summary` });
        await editor.setManualRouting(contactPoint);
        await editor.saveAndWaitForSuccess('created');
        await page.waitForURL(/\/alerting\/grafana\/[^/]+\/view/);
      });
      const uid = ruleUidFromUrl(page.url());
      alertRules.trackRule(uid);

      await measure(page, cdp, testInfo, 'alert rules: edit and save rule', async () => {
        await editor.gotoEdit(uid);
        await editor.setName(`${ruleName} edited`);
        await editor.saveAndWaitForSuccess('updated');
      });
      await waitForQuiet(page);
    }
  });

  test('silences: list and create', async ({ page }, testInfo) => {
    const cdp = await setupPerf(page);

    for (let i = 0; i < ITERATIONS; i++) {
      await measure(page, cdp, testInfo, 'silences: open new silence form', async () => {
        await page.goto('/alerting/silence/new');
        await page.getByPlaceholder('label').first().waitFor();
      });

      const value = `checkout-${unique()}`;
      await measure(page, cdp, testInfo, 'silences: fill in and save silence', async () => {
        await page.getByPlaceholder('label').first().fill('service');
        await page.getByPlaceholder('value').first().fill(value);
        await page.getByPlaceholder('Details about the silence').fill('Planned maintenance window');
        await page.getByRole('button', { name: 'Save silence' }).click();
        await page.waitForURL(/\/alerting\/silences/);
      });

      await measure(page, cdp, testInfo, 'silences: load list', async () => {
        await page.goto('/alerting/silences');
        await expect(page.getByText(value).first()).toBeVisible();
      });
    }
  });
});
