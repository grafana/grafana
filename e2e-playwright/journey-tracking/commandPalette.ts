import { type Page, type Locator } from '@playwright/test';

import { selectors } from '@grafana/e2e-selectors';
import { expect } from '@grafana/plugin-e2e';

/** KBar search input — scoped by placeholder so browse-page filter comboboxes don't match. */
export function commandPaletteInput(page: Page): Locator {
  return page.getByPlaceholder('Search or jump to...');
}

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
  await expect(commandPaletteInput(page)).toBeVisible();
}
