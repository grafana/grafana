import { Page } from 'playwright-core';

import { test, expect } from '@grafana/plugin-e2e';

const APP_ID = 'grafana-advisor-app';
const ADVISOR_PAGE = `/a/${APP_ID}`;

const testIds = {
  CheckDrillDown: {
    retryButton: (item: string) => `data-testid cd-retry-${item}`,
    actionLink: (item: string, message: string) =>
      `data-testid cd-action-link-${item}-${message.toLowerCase().replace(/\s+/g, '-')}`,
  },
};

test.use({
  featureToggles: {
    grafanaAdvisor: true,
  },
});

async function isEmptyReport(page: Page) {
  return await page.getByText('No checks run yet').isVisible();
}

async function loadAndWait(page: Page) {
  await page.goto(ADVISOR_PAGE);
  await expect(
    page.getByText(
      'Helps you keep your Grafana instances running smoothly and securely by running checks and suggest actions to fix identified issues'
    )
  ).toBeVisible();
  await expect(page.getByText('Loading')).not.toBeVisible();
}

async function expectEmptyReport(page: Page) {
  await loadAndWait(page);

  const isAlreadyEmpty = await isEmptyReport(page);

  if (!isAlreadyEmpty) {
    await page.getByRole('button', { name: 'Delete reports' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
  }

  await expect(page.getByText('No checks run yet')).toBeVisible();
}

async function runChecks(page: Page) {
  await loadAndWait(page);
  const isEmpty = await isEmptyReport(page);
  if (isEmpty) {
    await page.getByRole('button', { name: 'Generate report' }).click();
  } else {
    await page.getByRole('button', { name: 'Refresh' }).click();
  }

  await page
    .getByRole('button', { name: 'Running checks...' })
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  await expect(page.getByRole('button', { name: 'Running checks...' })).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Last checked')).toBeVisible();
}

async function createEmptyDatasource(page: Page): Promise<string> {
  await page.goto('/connections/datasources');
  await expect(page.getByText(/Add( new)? data source/)).toBeVisible();
  await page.getByText(/Add( new)? data source/).click();
  await page.getByRole('button', { name: 'Add new data source Prometheus' }).click();
  const dsName = await page.locator('#basic-settings-name').inputValue();
  return dsName;
}

test.describe(
  'Advisor',
  {
    tag: ['@various'],
  },
  () => {
    // Skip until flakiness is resolved
    test.skip('should detect an issue and fix it', async ({ page }) => {
      await expectEmptyReport(page);
      const dsName = await createEmptyDatasource(page);
      await runChecks(page);

      // Page should now show a report with the failing health check
      await page.getByText('Action needed').first().click();
      await page.getByText('Health check failed').click();
      // Click on the "Fix me" button
      await page.getByTestId(testIds.CheckDrillDown.actionLink(dsName, 'fix me')).click();
      // Now delete the datasource
      await expect(page.getByText('Loading')).not.toBeVisible();
      await page.getByText('Delete').click();
      await page.getByTestId('data-testid Confirm Modal Danger Button').click();

      // Now retrigger the report
      await loadAndWait(page);
      await page.getByText('Action needed').first().click();
      await page.getByText('Health check failed').click();
      await page.getByTestId(testIds.CheckDrillDown.retryButton(dsName)).click();
      // The issue should be fixed
      await expect(page.getByTestId(testIds.CheckDrillDown.actionLink(dsName, 'fix me'))).not.toBeVisible();
    });
  }
);
