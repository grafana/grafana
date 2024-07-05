import { test, expect } from '@grafana/plugin-e2e';

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
  },
};

const pluginId = 'myorg-extensionpoint-app';

test('should extend the actions menu with a link to a-app plugin', async ({ page }) => {
  await page.goto(`/a/${pluginId}/one`);
  await page.getByTestId(testIds.actions.button).click();
  await page.getByTestId(testIds.container).getByText('Go to A').click();
  await page.getByTestId(testIds.modal.open).click();
  await expect(page.getByTestId(testIds.appA.container)).toBeVisible();
});

test('should extend the actions menu with a command triggered from b-app plugin', async ({ page }) => {
  await page.goto(`/a/${pluginId}/one`);
  await page.getByTestId(testIds.actions.button).click();
  await page.getByTestId(testIds.container).getByText('Open from B').click();
  await expect(page.getByTestId(testIds.appB.modal)).toBeVisible();
});
