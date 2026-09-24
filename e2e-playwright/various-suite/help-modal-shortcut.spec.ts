import { test, expect } from '@grafana/plugin-e2e';

/**
 * The `?` shortcut is the only way into the shortcuts dialog — `keybinds.spec.ts` covers the
 * navigation and time-range bindings, but nothing covers the handler that opens this modal.
 */
test.describe(
  'Shortcuts help modal',
  {
    tag: ['@various'],
  },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('Welcome to Grafana')).toBeVisible();
    });

    test('shift+/ opens the shortcuts dialog and Escape closes it', async ({ page }) => {
      await page.keyboard.press('Shift+Slash');

      const dialog = page.getByRole('dialog', { name: 'Shortcuts' });
      await expect(dialog).toBeVisible();
      // The listed bindings are the content of the dialog, so assert one of them rather than the frame.
      await expect(dialog.getByText('Go to Home Dashboard')).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });

    test('the dialog close button dismisses it and the shortcut opens it again', async ({ page, selectors }) => {
      await page.keyboard.press('Shift+Slash');

      const dialog = page.getByRole('dialog', { name: 'Shortcuts' });
      await expect(dialog).toBeVisible();

      await dialog.getByTestId(selectors.components.Modal.closeButton).click();
      await expect(dialog).toBeHidden();

      await page.keyboard.press('Shift+Slash');
      await expect(page.getByRole('dialog', { name: 'Shortcuts' })).toBeVisible();
    });

    test('repeated shortcut presses leave a single dialog open', async ({ page }) => {
      await page.keyboard.press('Shift+Slash');
      await page.keyboard.press('Shift+Slash');
      await page.keyboard.press('Shift+Slash');

      const dialog = page.getByRole('dialog', { name: 'Shortcuts' });
      await expect(dialog).toHaveCount(1);
      await expect(dialog).toBeVisible();

      // One Escape has to be enough — stacked modals would leave one behind.
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Shortcuts' })).toHaveCount(0);
    });
  }
);
