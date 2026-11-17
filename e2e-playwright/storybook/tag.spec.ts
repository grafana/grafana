import { test, expect } from '@playwright/test';

test('removable tags retain list semantics and focus through removal and reset', async ({ page }) => {
  await page.goto('/iframe.html?id=information-tag--removable&viewMode=story');
  const list = page.getByRole('list', { name: 'Tags', exact: true });
  const items = list.getByRole('listitem');
  const production = list.getByRole('button', { name: 'Remove tag: Production', exact: true });
  const europe = list.getByRole('button', { name: 'Remove tag: Europe', exact: true });
  const frontend = list.getByRole('button', { name: 'Remove tag: Frontend', exact: true });
  const reset = page.getByRole('button', { name: 'Reset tags', exact: true });

  await expect(items).toHaveText(['Production', 'Europe', 'Frontend']);
  await europe.focus();
  await europe.press('Enter');
  await expect(items).toHaveText(['Production', 'Frontend']);
  await expect(frontend).toBeFocused();

  await frontend.press('Enter');
  await expect(items).toHaveText(['Production']);
  await expect(production).toBeFocused();

  await production.press('Space');
  await expect(items).toHaveCount(0);
  await expect(reset).toBeFocused();

  await reset.press('Enter');
  await expect(items).toHaveText(['Production', 'Europe', 'Frontend']);
  await production.focus();
  await production.press('Enter');
  await expect(items).toHaveText(['Europe', 'Frontend']);
  await expect(europe).toBeFocused();
});

test('removable story updates a polite status after removal and clears it on reset', async ({ page }) => {
  await page.goto('/iframe.html?id=information-tag--removable&viewMode=story');
  const status = page.getByRole('status');
  const items = page.getByRole('list', { name: 'Tags', exact: true }).getByRole('listitem');
  const removeProduction = page.getByRole('button', { name: 'Remove tag: Production', exact: true });
  const reset = page.getByRole('button', { name: 'Reset tags', exact: true });

  await expect(status).toHaveText('');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).toHaveAttribute('aria-atomic', 'true');

  await removeProduction.click();
  await expect(items).toHaveText(['Europe', 'Frontend']);
  await expect(status).toHaveText('Production removed');

  await reset.click();
  await expect(items).toHaveText(['Production', 'Europe', 'Frontend']);
  await expect(status).toHaveText('');

  await removeProduction.click();
  await expect(items).toHaveText(['Europe', 'Frontend']);
  await expect(status).toHaveText('Production removed');

  await page.getByRole('button', { name: 'Remove tag: Europe', exact: true }).click();
  await expect(status).toHaveText('Europe removed');
});

for (const theme of ['light', 'dark', 'visual_refresh_light', 'visual_refresh_dark']) {
  test(`short removable tag actions have non-overlapping 24px pointer targets in ${theme}`, async ({ page }) => {
    await page.goto(
      `/iframe.html?id=information-tag--label-and-remove&viewMode=story&globals=theme:${theme}&args=name:A`
    );
    const label = page.getByRole('button', { name: 'A', exact: true });
    const remove = page.getByRole('button', { name: 'Remove tag: A', exact: true });

    for (const button of [label, remove]) {
      await button.hover();
      const target = await button.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const points = [
          [rect.left + 1, rect.top + rect.height / 2],
          [rect.right - 1, rect.top + rect.height / 2],
          [rect.left + rect.width / 2, rect.top + 1],
          [rect.left + rect.width / 2, rect.bottom - 1],
        ];
        return {
          width: rect.width,
          height: rect.height,
          edgesHitButton: points.every(([x, y]) => document.elementFromPoint(x, y)?.closest('button') === element),
        };
      });
      expect(target.width).toBeGreaterThanOrEqual(24);
      expect(target.height).toBeGreaterThanOrEqual(24);
      expect(target.edgesHitButton).toBe(true);
    }

    const labelBox = await label.boundingBox();
    const removeBox = await remove.boundingBox();
    expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(removeBox!.x);
  });

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
