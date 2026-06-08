import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'WZ7AhQiVz';

test.describe('Panels test: Text', { tag: ['@panels'] }, () => {
  test('renders all panels on dashboard without errors', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

    const panelTitles = [
      'Markdown (with variables)',
      'HTML (with variables)',
      'JSON (with variables)',
      'Markdown (code w/ with variables)',
    ];
    for (const title of panelTitles) {
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(title))).toBeVisible();
    }

    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors in any panel').toBeHidden();
  });

  test('markdown mode renders and interpolates variables', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '4' }),
    });

    const panelContent = page.getByTestId('TextPanel-converted-content');
    await expect(panelContent).toBeVisible();
    await expect(panelContent.locator('h2').first()).toBeVisible();
    await expect(panelContent.locator('h3').first()).toBeVisible();
    await expect(panelContent.locator('hr')).toBeVisible();
    await expect(panelContent).toContainText('text = temp');
  });

  test('html mode renders content correctly', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '6' }),
    });

    const panelContent = page.getByTestId('TextPanel-converted-content');
    await expect(panelContent).toBeVisible();
    await expect(panelContent.locator('h3').first()).toHaveText('Data center');
    await expect(panelContent.locator('h3')).toHaveCount(4);
  });

  test('code mode renders monaco editor with line numbers and minimap', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '7' }),
    });

    const monacoEditor = page.locator('.monaco-editor').first();
    await expect(monacoEditor).toBeVisible();
    await expect(monacoEditor).toContainText('Data center');
    await expect(monacoEditor.locator('.line-numbers')).not.toHaveCount(0);
    await expect(monacoEditor.locator('.minimap')).toBeVisible();
  });

  test('can switch between modes in panel editor', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '4' }),
    });

    const panelContent = page.getByTestId('TextPanel-converted-content');
    await expect(panelContent).toBeVisible();

    await page.getByRole('radio', { name: 'HTML' }).click();
    await expect(panelContent).toBeVisible();

    await page.getByRole('radio', { name: 'Code' }).click();
    await expect(page.locator('.monaco-editor').first()).toBeVisible();

    await page.getByRole('radio', { name: 'Markdown' }).click();
    await expect(panelContent).toBeVisible();
  });
});
