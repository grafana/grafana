import { type Page } from '@playwright/test';

// The dev server runs `yarn start:rspack:noHmr`: any file change anywhere in the app triggers
// a full rebuild rather than a hot patch, so a request that lands mid-rebuild can 404 a chunk
// and render Grafana's own "failed to load its application files" fallback instead of the
// app. That's a dev-server race, not a broken route — reload and retry a few times rather
// than fail the whole test on what's effectively a transient network error.
const APP_LOAD_FAILURE_TEXT = 'Grafana has failed to load its application files';

export async function gotoResilient(page: Page, url: string, attempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await page.goto(url);
    const failed = await page
      .getByText(APP_LOAD_FAILURE_TEXT)
      .isVisible()
      .catch(() => false);
    if (!failed) {
      return;
    }
    if (attempt === attempts) {
      throw new Error(`Grafana failed to load its application files after ${attempts} attempts navigating to ${url}`);
    }
    await page.waitForTimeout(1000 * attempt);
  }
}
