import { test, expect } from '@grafana/plugin-e2e';

test.use({ openFeature: { flags: { pieChartGradientColorScheme: true } } });

test('Pie chart switches between gradient and classic colors', async ({ gotoDashboardPage, page }) => {
  const dashboard = await gotoDashboardPage({});
  const editor = await dashboard.addPanel();
  await editor.setVisualization('Pie chart');
  const colorScheme = page.getByRole('combobox', { name: 'Color scheme', exact: true });
  await colorScheme.click();
  await page.getByRole('option', { name: /^Gradient Interpolate/ }).click();
  await expect(page.getByText('Gradient', { exact: true })).toBeVisible();
  await colorScheme.click();
  await page.getByRole('option', { name: 'Classic palette', exact: true }).click();
  await expect(page.getByText('Classic palette', { exact: true })).toBeVisible();
  await expect(page.getByText('Gradient', { exact: true })).toBeHidden();
});
