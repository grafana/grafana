import { expect, test } from '@grafana/plugin-e2e';
import { ensureExtensionRegistryIsPopulated } from '../utils';

const panelTitle = 'Link with defaults';
const extensionTitle = 'Open from time series...';

const linkOnClickDashboardUid = 'dbfb47c5-e5e5-4d28-8ac7-35f349b95946';
const linkPathDashboardUid = 'd1fbb077-cd44-4738-8c8a-d4e66748b719';

test.describe('configureExtensionLink targeting core extension points', () => {
  test('configureExtensionLink - should add link extension (path) with defaults to time series panel.', async ({
    gotoDashboardPage,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid: linkPathDashboardUid });
    await ensureExtensionRegistryIsPopulated(page);
    const panel = await dashboardPage.getPanelByTitle(panelTitle);
    await panel.clickOnMenuItem(extensionTitle, { parentItem: 'Extensions' });
    await expect(page.getByRole('heading', { name: 'Extensions test app' })).toBeVisible();
  });

  test('should add link extension (onclick) with defaults to time series panel', async ({
    gotoDashboardPage,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid: linkOnClickDashboardUid });
    await ensureExtensionRegistryIsPopulated(page);
    const panel = await dashboardPage.getPanelByTitle(panelTitle);
    await panel.clickOnMenuItem(extensionTitle, { parentItem: 'Extensions' });
    await expect(page.getByRole('dialog')).toContainText('Select query from "Link with defaults"');
  });

  test('should add link extension (onclick) with new title to pie chart panel', async ({ gotoDashboardPage, page }) => {
    const panelTitle = 'Link with new name';
    const extensionTitle = 'Open from piechart';
    const dashboardPage = await gotoDashboardPage({ uid: linkOnClickDashboardUid });
    await ensureExtensionRegistryIsPopulated(page);
    const panel = await dashboardPage.getPanelByTitle(panelTitle);
    await panel.clickOnMenuItem(extensionTitle, { parentItem: 'Extensions' });
    await expect(page.getByRole('dialog')).toContainText('Select query from "Link with new name"');
  });
});
