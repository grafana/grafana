import * as e2e from '@grafana/e2e-selectors';
import { expect, test } from '@grafana/plugin-e2e';

const QUERY_AND_EXPRESSION_STEP = '2';

test.use({ featureToggles: { alertingNotificationsStepMode: false } });

test.describe('plugin-e2e-api-tests admin', { tag: ['@plugins'] }, () => {
  test('should evaluate to false if entire request returns 200 but partial query result is invalid', async ({
    page,
    alertRuleEditPage,
  }) => {
    await alertRuleEditPage.alertRuleNameField.fill('Test Alert Rule');

    const advancedSwitch = alertRuleEditPage.getByGrafanaSelector(
      e2e.selectors.components.AlertRules.stepAdvancedModeSwitch(QUERY_AND_EXPRESSION_STEP)
    );
    await expect(advancedSwitch).toBeVisible();
    await advancedSwitch.check({ force: true });

    // broken query - first so plugin-e2e's evaluate() helper picks up its non-2xx status
    const queryA = alertRuleEditPage.getAlertRuleQueryRow('A');
    await queryA.datasource.set('gdev-prometheus');
    await queryA.locator.getByLabel('Code').click();
    await page.waitForFunction(() => window.monaco);
    await queryA.getByGrafanaSelector(e2e.selectors.components.QueryField.container).click();
    await page.keyboard.insertText('topk(5,');

    // working query (clickAddQueryRow gates on the removed alertingQueryAndExpressionsStepMode toggle)
    await alertRuleEditPage.getByGrafanaSelector(e2e.selectors.components.QueryTab.addQuery).click();
    const queryB = alertRuleEditPage.getAlertRuleQueryRow('B');
    await queryB.datasource.set('gdev-prometheus');
    await queryB.locator.getByLabel('Code').click();
    await queryB.getByGrafanaSelector(e2e.selectors.components.QueryField.container).click();
    await page.keyboard.insertText('topk(5, max(scrape_duration_seconds) by (job))');

    await expect(alertRuleEditPage.evaluate()).not.toBeOK();
  });
});
