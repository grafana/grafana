import * as e2e from '@grafana/e2e-selectors';
import { expect, test } from '@grafana/plugin-e2e';

// let's disable the feature toggles for now, otherwise the getAlertRuleQueryRow fails and I don't see any other way to get the query row
test.use({ featureToggles: { alertingQueryAndExpressionsStepMode: false, alertingNotificationsStepMode: false } });

test.describe('plugin-e2e-api-tests admin', { tag: ['@plugins'] }, () => {
  test('should evaluate to false if entire request returns 200 but partial query result is invalid', async ({
    page,
    alertRuleEditPage,
  }) => {
    await alertRuleEditPage.alertRuleNameField.fill('Test Alert Rule');

    //add working query
    const queryA = alertRuleEditPage.getAlertRuleQueryRow('A');
    await queryA.datasource.set('gdev-prometheus');
    await queryA.locator.getByLabel('Code').click();
    await page.waitForFunction(() => window.monaco);
    await queryA.getByGrafanaSelector(e2e.selectors.components.QueryField.container).click();
    await page.keyboard.insertText('topk(5, max(scrape_duration_seconds) by (job))');

    //add broken query
    const newQuery = await alertRuleEditPage.clickAddQueryRow();
    await newQuery.datasource.set('gdev-prometheus');
    await newQuery.locator.getByLabel('Code').click();
    await newQuery.getByGrafanaSelector(e2e.selectors.components.QueryField.container).click();
    await page.keyboard.insertText('topk(5,');

    await expect(alertRuleEditPage.evaluate()).not.toBeOK();
  });
});
