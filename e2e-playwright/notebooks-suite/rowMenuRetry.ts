import { type Locator } from '@playwright/test';

/**
 * Opens a notebook row's kebab menu and runs `interact` against it, retrying the whole
 * open-then-interact sequence if the menu closes underneath it - e.g. a concurrently running
 * test's own notebook create/delete invalidating this page's list query and remounting the row
 * mid-click. Seen in CI (shared server, several workers) but not reproduced locally.
 */
export async function withRowMenuOpen(
  rowMenuButton: Locator,
  interact: () => Promise<void>,
  attempts = 3
): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    // The trigger toggles the menu, so a retry can't assume it's closed - `interact` may have
    // failed for a reason other than the menu closing on it (a stray overlay, a slow animation),
    // in which case clicking the trigger again would close an already-open menu instead of
    // reopening one. Escape first so every attempt starts from the same closed state.
    await rowMenuButton.page().keyboard.press('Escape');
    await rowMenuButton.click();
    try {
      await interact();
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
    }
  }
}
