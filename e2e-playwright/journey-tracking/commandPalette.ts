import { type Page } from '@playwright/test';

import { selectors } from '@grafana/e2e-selectors';
import { expect } from '@grafana/plugin-e2e';

/**
 * Open the command palette via the nav toolbar trigger.
 *
 * Prefer this over Ctrl/Cmd+K: Chromium treats Ctrl+K as a browser chrome
 * shortcut in some environments, so the page handler never runs in CI.
 */
export async function openCommandPalette(page: Page) {
  const trigger = page.getByTestId(selectors.components.NavToolbar.commandPaletteTrigger);
  await expect(trigger).toBeVisible();
  // The testid is on the wrapper; the interactive control is the inner button.
  await trigger.getByRole('button').click();
  // KBarSearch renders with role="combobox"
  await expect(page.getByRole('combobox')).toBeVisible();
}
