import { test, expect } from '@playwright/test';

// very basic test intended to catch just some basic build errors with storybook
test.describe('Verify storybook', { tag: ['@storybook'] }, () => {
  test('Loads the button story correctly', async ({ page }) => {
    await page.goto('?path=/story/inputs-button--basic');
    const iframe = page.locator('#storybook-preview-iframe');
    await expect(iframe).toBeVisible();
    const iframeBody = iframe.contentFrame();
    await expect(iframeBody.getByText('Example button')).toBeVisible();
  });

  test('replaces the legacy stylesheet when the theme changes', async ({ page }) => {
    await page.goto('?path=/story/inputs-button--basic&globals=theme:dark');
    const frame = page.frameLocator('#storybook-preview-iframe');
    await frame.locator('body').evaluate((body) => {
      body.insertAdjacentHTML(
        'beforeend',
        '<div class="alert-handle-wrapper"><div class="alert-handle-value"><div class="alert-handle-grip"></div></div></div>'
      );
    });
    const grip = frame.locator('.alert-handle-grip');
    const backgroundImage = () => grip.evaluate((element) => getComputedStyle(element).backgroundImage);

    await expect.poll(backgroundImage).toContain('grab_dark.svg');

    await page.getByRole('button', { name: 'Global theme for components' }).click();
    await page.getByRole('option', { name: 'Light', exact: true }).click();
    await expect.poll(backgroundImage).toContain('grab_light.svg');

    await page.getByRole('button', { name: 'Global theme for components' }).click();
    await page.getByRole('option', { name: 'Dark', exact: true }).click();
    await expect.poll(backgroundImage).toContain('grab_dark.svg');
  });
});
