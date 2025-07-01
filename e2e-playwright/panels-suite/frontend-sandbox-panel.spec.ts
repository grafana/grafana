import { test, expect } from '@grafana/plugin-e2e';

import panelSandboxDashboard from '../dashboards/PanelSandboxDashboard.json';

const DASHBOARD_ID = 'c46b2460-16b7-42a5-82d1-b07fbf431950';

test.beforeAll(async ({ request }) => {
  // Import the dashboard
  await request.post('/api/dashboards/import', {
    data: {
      dashboard: panelSandboxDashboard,
      folderUid: '',
      overwrite: true,
      inputs: [],
    },
  });
});

test.describe(
  'Panels test: Panel sandbox',
  {
    tag: ['@panels'],
  },
  () => {
    test.describe('Sandbox disabled', () => {
      test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
          window.localStorage.setItem('grafana.featureToggles', 'pluginsFrontendSandbox=0');
        });
        await page.reload();
      });

      test('Add iframes to body', async ({ page, gotoDashboardPage }) => {
        await gotoDashboardPage({
          uid: DASHBOARD_ID,
        });

        // this button adds iframes to the body
        await page.locator('[data-testid="button-create-iframes"]').click();

        const iframeIds = [
          'createElementIframe',
          'innerHTMLIframe',
          'appendIframe',
          'prependIframe',
          'afterIframe',
          'beforeIframe',
          'outerHTMLIframe',
          'parseFromStringIframe',
          'insertBeforeIframe',
          'replaceChildIframe',
        ];

        for (const id of iframeIds) {
          await expect(page.locator(`#${id}`)).toBeVisible();
        }
      });

      test('Reaches out of panel div', async ({ page, gotoDashboardPage }) => {
        await gotoDashboardPage({
          uid: DASHBOARD_ID,
        });

        // this button reaches out of the panel div and modifies the element dataset
        await page.locator('[data-testid="button-reach-out"]').click();
        await expect(page.locator('[data-sandbox-test="true"]')).toBeVisible();
      });

      test('Reaches out of the panel editor', async ({ gotoDashboardPage, page }) => {
        await gotoDashboardPage({
          uid: DASHBOARD_ID,
          queryParams: new URLSearchParams({ editPanel: '1' }),
        });

        const input = page.locator('[data-testid="panel-editor-custom-editor-input"]');
        await expect(input).toBeEnabled();
        await expect(input).toHaveValue('');

        await input.fill('x');
        await expect(input).toHaveValue('x');
        await expect(page.locator('[data-sandbox-test="panel-editor"]')).toBeVisible();
      });
    });

    test.describe('Sandbox enabled', () => {
      test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
          window.localStorage.setItem('grafana.featureToggles', 'pluginsFrontendSandbox=1');
        });
        await page.reload();
      });

      test('Does not add iframes to body', async ({ page, gotoDashboardPage }) => {
        await gotoDashboardPage({
          uid: DASHBOARD_ID,
        });

        // this button adds 3 iframes to the body
        await page.locator('[data-testid="button-create-iframes"]').click();

        const iframeIds = [
          'createElementIframe',
          'innerHTMLIframe',
          'appendIframe',
          'prependIframe',
          'afterIframe',
          'beforeIframe',
          'outerHTMLIframe',
          'parseFromStringIframe',
          'insertBeforeIframe',
          'replaceChildIframe',
        ];

        for (const id of iframeIds) {
          await expect(page.locator(`#${id}`)).toBeHidden();
        }
      });

      test('Does not reaches out of panel div', async ({ page, gotoDashboardPage }) => {
        await gotoDashboardPage({
          uid: DASHBOARD_ID,
        });

        // this button reaches out of the panel div and modifies the element dataset
        await page.locator('[data-testid="button-reach-out"]').click();
        await expect(page.locator('[data-sandbox-test="true"]')).toBeHidden();
      });

      test('Does not Reaches out of the panel editor', async ({ gotoDashboardPage, page }) => {
        await gotoDashboardPage({
          uid: DASHBOARD_ID,
          queryParams: new URLSearchParams({ editPanel: '1' }),
        });

        const input = page.locator('[data-testid="panel-editor-custom-editor-input"]');
        await expect(input).toBeEnabled();

        await input.fill('x');
        await expect(page.locator('[data-sandbox-test="panel-editor"]')).toBeHidden();
      });

      test('Can access specific window global variables', async ({ page, gotoDashboardPage }) => {
        await gotoDashboardPage({
          uid: DASHBOARD_ID,
        });

        await page.locator('[data-testid="button-test-globals"]').click();
        await expect(page.locator('[data-sandbox-global="Prism"]')).toBeVisible();
        await expect(page.locator('[data-sandbox-global="jQuery"]')).toBeVisible();
        await expect(page.locator('[data-sandbox-global="location"]')).toBeVisible();
      });
    });
  }
);
