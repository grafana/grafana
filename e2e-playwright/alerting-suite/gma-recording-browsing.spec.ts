import { test, expect } from '@grafana/plugin-e2e';

import { requireCorpusManifest } from './corpus/corpusState';
import { gotoResilient } from './waitForAppLoad';

// Same shared corpus as gma-alert-browsing.spec.ts — the dense folder holds 80 Recording
// rules too, in the same 42 folders. Assertions stay scoped to the run marker / manifest
// counts, never an organization-wide total.
test.describe('Recording rules: Folders and List browsing', () => {
  test.slow();

  test('REC-1/2: the dense folder shows its direct Recording count, Load more reveals the rest, and searches are Recording-only', async ({
    page,
  }) => {
    const manifest = requireCorpusManifest();

    const dense = manifest.folders.find((f) => f.uid === manifest.denseFolderUid)!;

    let sawAlertRuleSearch = false;
    page.on('request', (request) => {
      if (request.url().includes('/alertrules/searchRules')) {
        sawAlertRuleSearch = true;
      }
    });

    await gotoResilient(page, '/alerting/rules/recording');

    const denseRow = page.getByRole('button', { name: dense.title });
    await expect(denseRow).toBeVisible({ timeout: 20_000 });
    await expect(denseRow.locator('xpath=..')).toContainText(String(dense.recordingRuleUids.length));

    await denseRow.click();
    const denseLinks = page.getByRole('link', { name: new RegExp(manifest.runMarker) });
    await expect(denseLinks).toHaveCount(40, { timeout: 20_000 });

    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(denseLinks).toHaveCount(dense.recordingRuleUids.length, { timeout: 20_000 });

    expect(sawAlertRuleSearch).toBe(false);
  });

  test('REC-2: List mode loads three 40-rule batches for a corpus-scoped filter', async ({ page }) => {
    const manifest = requireCorpusManifest();

    await gotoResilient(page, '/alerting/rules/recording');
    await page.getByRole('radio', { name: 'List' }).click();

    const search = page.getByRole('textbox', { name: /search/i });
    await search.fill(`label:e2e-corpus-run=${manifest.runMarker}`);
    await search.press('Enter');

    const links = page.getByRole('link', { name: new RegExp(manifest.runMarker) });
    await expect(links).toHaveCount(40, { timeout: 20_000 });

    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(links).toHaveCount(80, { timeout: 20_000 });
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(links).toHaveCount(120, { timeout: 20_000 });
  });
});
