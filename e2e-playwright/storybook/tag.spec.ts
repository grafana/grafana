import { test, expect } from '@playwright/test';

for (const theme of ['light', 'dark', 'visual_refresh_light', 'visual_refresh_dark']) {
  test(`removable tag hover feedback stays on the individual action in ${theme}`, async ({ page }) => {
    await page.goto(`/iframe.html?id=information-tag--states&viewMode=story&globals=theme:${theme}`);
    const label = page.getByRole('button', { name: 'Both actions', exact: true });
    const remove = page.getByRole('button', { name: 'Remove tag: Both actions', exact: true });
    const tag = label.locator('..');

    await label.hover();
    await expect(label).toHaveCSS('opacity', '0.85');
    await expect(tag).toHaveCSS('opacity', '1');
    await expect(remove).toHaveCSS('opacity', '1');

    await remove.hover();
    await expect(label).toHaveCSS('opacity', '1');
    await expect(tag).toHaveCSS('opacity', '1');
    await expect(remove).toHaveCSS('opacity', '1');
  });
}
