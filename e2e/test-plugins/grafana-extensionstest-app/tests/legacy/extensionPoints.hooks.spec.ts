import { test, expect } from '@grafana/plugin-e2e';

import { testIds } from '../../testIds';
import pluginJson from '../../plugin.json';
import testApp3pluginJson from '../../plugins/grafana-extensionexample3-app/plugin.json';

test.describe('usePluginExtensions + configureExtensionLink', () => {
  test('should extend the actions menu with a link to a-app plugin', async ({ page }) => {
    await page.goto(`/a/${pluginJson.id}/legacy-hooks`);
    const section = await page.getByTestId(testIds.legacyHooksPage.section1);
    await section.getByTestId(testIds.actions.button).click();
    await page.getByTestId(testIds.container).getByText('Go to A').click();
    await page.getByTestId(testIds.modal.open).click();
    await expect(page.getByTestId(testIds.appA.container)).toBeVisible();
  });

  test('should not display extensions that have not been declared in plugin.json when in development mode', async ({
    page,
  }) => {
    await page.goto(`/a/${pluginJson.id}/legacy-hooks`);
    const section = await page.getByTestId(testIds.legacyHooksPage.section1);
    await section.getByTestId(testIds.actions.button).click();
    await expect(
      page.getByTestId(testIds.container).getByText('configureExtensionLink (where meta data is missing)')
    ).not.toBeVisible();
  });
});

test.describe('usePluginExtensions + configureExtensionComponent', () => {
  test('should extend main app with component extension from app B', async ({ page }) => {
    await page.goto(`/a/${pluginJson.id}/legacy-hooks`);
    const section = await page.getByTestId(testIds.legacyHooksPage.section1);
    await section.getByTestId(testIds.actions.button).click();
    await page.getByTestId(testIds.container).getByText('Open from B').click();
    await expect(page.getByTestId(testIds.appB.modal)).toBeVisible();
  });
});

test.describe('usePluginLinkExtensions + configureExtensionLink', () => {
  test('should extend the actions menu with a link to a-app plugin', async ({ page }) => {
    await page.goto(`/a/${pluginJson.id}/legacy-hooks`);
    const section = await page.getByTestId(testIds.legacyHooksPage.section2);
    await section.getByTestId(testIds.actions.button).click();
    await page.getByTestId(testIds.container).getByText('Go to A').click();
    await page.getByTestId(testIds.modal.open).click();
    await expect(page.getByTestId(testIds.appA.container)).toBeVisible();
  });
});

test.describe('usePluginComponentExtensions + configureExtensionComponent', () => {
  test('should extend the actions menu with a command triggered from b-app plugin', async ({ page }) => {
    await page.goto(`/a/${pluginJson.id}/legacy-hooks`);
    await expect(
      page.getByTestId(testIds.legacyHooksPage.section3).getByTestId(testIds.appB.reusableComponent)
    ).toHaveText('Hello World!');
  });
});

test.describe('usePluginExtensions + addLink', () => {
  test('should not display extensions in case extension point has not been declared in plugin json (dev mode only)', async ({
    page,
  }) => {
    await page.goto(`/a/${testApp3pluginJson.id}/legacy-hooks`);
    const section = await page.getByTestId(testIds.appC.section2);
    await expect(section.getByTestId(testIds.actions.button)).not.toBeVisible();
  });
});
