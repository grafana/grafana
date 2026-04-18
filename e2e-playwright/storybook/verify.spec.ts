import { test, expect } from '@grafana/plugin-e2e';
// very basic test to verify that the button story loads correctly
// this is only intended to catch some basic build errors with storybook
test.describe(
  'Verify storybook',
  {
    tag: ['@storybook'],
  },
  () => {
    test('Loads the button story correctly', async ({ page }) => {
      await page.goto('?path=/story/inputs-button--basic');
      const iframe = page.locator('#storybook-preview-iframe');
      await expect(iframe).toBeVisible();
      const iframeBody = iframe.contentFrame();
      await expect(iframeBody.getByText('Example button')).toBeVisible();
    });
  }
);
