import { selectors } from '@grafana/e2e-selectors';
import { test, expect } from '@grafana/plugin-e2e';

import { version } from '../../package.json';

test.use({ grafanaVersion: version });

test.describe('Table field previews', { tag: ['@table', '@a11y'] }, () => {
  for (const theme of ['light', 'dark']) {
    test(`keyboard access and colored backgrounds (${theme})`, async ({ page, scanForA11yViolations }) => {
      await page.goto(`/iframe.html?id=plugins-table-ng--field-previews&viewMode=story&globals=theme:${theme}`);
      const markers = page.getByTestId(selectors.components.Panels.Visualization.TableNG.Tooltip.Caret);
      const trigger = markers.first();
      const preview = page.getByTestId(selectors.components.Panels.Visualization.TableNG.Tooltip.Wrapper);
      await expect(page.getByRole('columnheader', { name: 'Link preview', exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Before table' }).focus();
      await trigger.hover();
      await expect(preview).toHaveAttribute('role', 'dialog');
      await expect(page.getByRole('button', { name: 'Before table' })).toBeFocused();

      await trigger.focus();
      await trigger.press('Enter');
      await expect(preview).toBeFocused();
      await expect(preview).toMatchAriaSnapshot(`
        - dialog "Cell preview":
          - link "Open details":
            - /url: "#details"
      `);
      await page.keyboard.press('Tab');
      await expect(preview.getByRole('link', { name: 'Open details' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#details$/);
      await expect(preview).toBeVisible();
      const report = await scanForA11yViolations({
        include: ['[role="dialog"]'],
        options: { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      });
      expect(report).toHaveNoA11yViolations();
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      await expect(preview).toBeHidden();

      await markers.nth(1).click();
      await expect(preview).toHaveText('Healthy');
      const fieldOnlyBackground = await preview.evaluate((el) => getComputedStyle(el).background);
      expect(fieldOnlyBackground).toContain('rgb(0, 100, 0)');
      await preview.click({ position: { x: 3, y: 3 } });
      await expect(preview).toBeVisible();
      await page.keyboard.press('Escape');

      await markers.nth(3).click();
      await expect(preview).toContainText('Healthy');
      await expect(preview.getByRole('separator')).toBeVisible();
      expect(await preview.evaluate((el) => getComputedStyle(el).background)).not.toBe(fieldOnlyBackground);
      await expect
        .poll(() =>
          preview.getByText('Healthy', { exact: true }).evaluate((el) => getComputedStyle(el.parentElement!).background)
        )
        .toBe(fieldOnlyBackground);
      await page.getByRole('button', { name: 'After table' }).click();
      await expect(page.getByRole('button', { name: 'After table' })).toBeFocused();
      await expect(preview).toBeHidden();
    });
  }
});
