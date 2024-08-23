import { test, expect } from '@grafana/plugin-e2e';

import { ensureExtensionRegistryIsPopulated } from './utils';

const testIds = {
  container: 'main-app-body',
  actions: {
    button: 'action-button',
  },
  modal: {
    container: 'container',
    open: 'open-link',
  },
  appA: {
    container: 'a-app-body',
  },
  appB: {
    modal: 'b-app-modal',
    reusableComponent: 'b-app-configure-extension-component',
  },
  legacyAPIPage: {
    container: 'data-testid pg-two-container',
  },
};

const pluginId = 'grafana-extensionstest-app';

test('should extend the actions menu with a link to a-app plugin', async ({ page }) => {
  await page.goto(`/a/${pluginId}/legacy-apis`);
  await ensureExtensionRegistryIsPopulated(page);
  await page.getByTestId(testIds.actions.button).click();
  await page.getByTestId(testIds.container).getByText('Go to A').click();
  await page.getByTestId(testIds.modal.open).click();
  await expect(page.getByTestId(testIds.appA.container)).toBeVisible();
});

test('should extend the actions menu with a command triggered from b-app plugin', async ({ page }) => {
  await page.goto(`/a/${pluginId}/legacy-apis`);
  await ensureExtensionRegistryIsPopulated(page);
  await expect(
    page.getByTestId(testIds.legacyAPIPage.container).getByTestId(testIds.appB.reusableComponent)
  ).toHaveText('Hello World!');
});

test('should extend main app with component extension from app B', async ({ page }) => {
  await page.goto(`/a/${pluginId}/legacy-apis`);
  await ensureExtensionRegistryIsPopulated(page);
  await page.getByTestId(testIds.actions.button).click();
  await page.getByTestId(testIds.container).getByText('Open from B').click();
  await expect(page.getByTestId(testIds.appB.modal)).toBeVisible();
});
