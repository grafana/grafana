import { test, expect } from '@grafana/plugin-e2e';

test.use({ openFeature: { flags: { enableColorblindSafePanelOptions: true } } });

test('switches between accessible and solid lines and between color palettes', async ({ gotoDashboardPage, page }) => {
  const dashboard = await gotoDashboardPage({});
  const editor = await dashboard.addPanel();
  await editor.setVisualization('Time series');
  const accessible = page.getByRole('radio', { name: 'Accessible', exact: true });
  const solid = page.getByRole('radio', { name: 'Solid', exact: true });
  await accessible.check();
  await expect(accessible).toBeChecked();
  await solid.check();
  await expect(solid).toBeChecked();
  await expect(accessible).not.toBeChecked();

  const colorScheme = page.getByRole('combobox', { name: 'Color scheme', exact: true });
  await colorScheme.click();
  await page.getByRole('option', { name: 'Color blind safe', exact: true }).click();
  await expect(page.getByText('Color blind safe', { exact: true })).toBeVisible();
  await colorScheme.click();
  await page.getByRole('option', { name: 'Classic palette', exact: true }).click();
  await expect(page.getByText('Classic palette', { exact: true })).toBeVisible();
});
