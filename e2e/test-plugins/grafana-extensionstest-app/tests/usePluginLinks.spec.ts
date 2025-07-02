import { test, expect } from '@grafana/plugin-e2e';

import pluginJson from '../plugin.json';
import testApp3pluginJson from '../plugins/grafana-extensionexample3-app/plugin.json';
import { testIds } from '../testIds';

test('should extend the actions menu with a link to a-app plugin', async ({ page }) => {
  await page.goto(`/a/${pluginJson.id}/added-links`);
  const section = await page.getByTestId(testIds.addedLinksPage.section1);
  await section.getByTestId(testIds.actions.button).click();
  await page.getByTestId(testIds.container).getByText('Go to A').click();
  await page.getByTestId(testIds.modal.open).click();
  await expect(page.getByTestId(testIds.appA.container)).toBeVisible();
});

test('should extend main app with link extension from app B', async ({ page }) => {
  await page.goto(`/a/${pluginJson.id}/added-links`);
  const section = await page.getByTestId(testIds.addedLinksPage.section1);
  await section.getByTestId(testIds.actions.button).click();
  await page.getByTestId(testIds.container).getByText('Open from B').click();
  await expect(page.getByTestId(testIds.appB.modal)).toBeVisible();
});

test('should extend main app with basic link extension from app A', async ({ page }) => {
  await page.goto(`/a/${pluginJson.id}/added-links`);
  const section = await page.getByTestId(testIds.addedLinksPage.section1);
  await section.getByTestId(testIds.actions.button).click();
  await page.getByTestId(testIds.container).getByText('Basic link').click();
  await page.getByTestId(testIds.modal.open).click();
  await expect(page.getByTestId(testIds.appA.container)).toBeVisible();
});

test('should not display any extensions when extension point is not declared in plugin json when in development mode', async ({
  page,
}) => {
  await page.goto(`/a/${testApp3pluginJson.id}`);
  const container = await page.getByTestId(testIds.appC.section1);
  await expect(container.getByTestId(testIds.actions.button)).not.toBeVisible();
});

const panelTitle = 'Link with defaults';
const extensionTitle = 'Open from time series...';

const linkOnClickDashboardUid = 'dbfb47c5-e5e5-4d28-8ac7-35f349b95946';
const linkPathDashboardUid = 'd1fbb077-cd44-4738-8c8a-d4e66748b719';

test('configureExtensionLink - should add link extension (path) with defaults to time series panel.', async ({
  gotoDashboardPage,
  page,
}) => {
  const dashboardPage = await gotoDashboardPage({ uid: linkPathDashboardUid });
  const panel = await dashboardPage.getPanelByTitle(panelTitle);
  await panel.clickOnMenuItem(extensionTitle, { parentItem: 'Extensions' });
  await expect(page.getByRole('heading', { name: 'Extensions test app' })).toBeVisible();
});

test('should add link extension (onclick) with defaults to time series panel', async ({ gotoDashboardPage, page }) => {
  const dashboardPage = await gotoDashboardPage({ uid: linkOnClickDashboardUid });
  const panel = await dashboardPage.getPanelByTitle(panelTitle);
  await panel.clickOnMenuItem(extensionTitle, { parentItem: 'Extensions' });
  await expect(page.getByRole('dialog')).toContainText('Select query from "Link with defaults"');
});

test('should add link extension (onclick) with new title to pie chart panel', async ({ gotoDashboardPage, page }) => {
  const panelTitle = 'Link with new name';
  const extensionTitle = 'Open from piechart';
  const dashboardPage = await gotoDashboardPage({ uid: linkOnClickDashboardUid });
  const panel = await dashboardPage.getPanelByTitle(panelTitle);
  await panel.clickOnMenuItem(extensionTitle, { parentItem: 'Extensions' });
  await expect(page.getByRole('dialog')).toContainText('Select query from "Link with new name"');
});
