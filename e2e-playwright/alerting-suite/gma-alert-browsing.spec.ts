import { test, expect } from '@grafana/plugin-e2e';

import { requireCorpusManifest } from './corpus/corpusState';
import { gotoResilient } from './waitForAppLoad';

// Depends on the shared corpus (see playwright.config.ts `alerting-corpus-setup`/`-teardown`):
// 42 folders, one dense with 80 Alert rules, one untouched, run this spec's project with
// `alerting-corpus-setup` as a dependency so the manifest exists before these run. Every
// assertion is scoped to the run marker or the manifest's own folder/rule counts — never an
// organization-wide total, since other tests and pre-existing data share this instance.
test.describe('Alert rules: Folders and List browsing', () => {
  test.slow();

  test('ALERT-1/2: the dense folder shows its direct Alert count, Load more reveals the rest, and a still-collapsed folder is never fetched', async ({
    page,
  }) => {
    const manifest = requireCorpusManifest();

    const dense = manifest.folders.find((f) => f.uid === manifest.denseFolderUid)!;
    const untouched = manifest.folders.find(
      (f) => f.uid !== manifest.denseFolderUid && f.uid !== manifest.emptyFolderUid
    )!;

    const searchRequestBodies: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/alertrules/searchRules')) {
        searchRequestBodies.push(request.postData() ?? '');
      }
    });

    await gotoResilient(page, '/alerting/rules/alert');

    const denseRow = page.getByRole('button', { name: dense.title });
    await expect(denseRow).toBeVisible({ timeout: 20_000 });
    await expect(denseRow.locator('xpath=..')).toContainText(String(dense.alertRuleUids.length));

    // Collapsed folders issue no rule request at all — not even the untouched one this test
    // never interacts with.
    expect(searchRequestBodies.some((body) => body.includes(untouched.uid))).toBe(false);

    await denseRow.click();
    const denseLinks = page.getByRole('link', { name: new RegExp(manifest.runMarker) });
    await expect(denseLinks).toHaveCount(40, { timeout: 20_000 });

    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(denseLinks).toHaveCount(dense.alertRuleUids.length, { timeout: 20_000 });

    expect(searchRequestBodies.some((body) => body.includes(untouched.uid))).toBe(false);
  });

  test('ALERT-1: Folder Previous/Next moves the dense folder off and back onto the visible page', async ({ page }) => {
    const manifest = requireCorpusManifest();
    const dense = manifest.folders.find((f) => f.uid === manifest.denseFolderUid)!;

    await gotoResilient(page, '/alerting/rules/alert');
    const denseRow = page.getByRole('button', { name: dense.title });
    // The dense folder's title starts with "API gateway", alphabetically early enough to
    // land on the first 40-folder page among this instance's ~14 pre-existing folders plus
    // the corpus's 42.
    await expect(denseRow).toBeVisible({ timeout: 20_000 });

    const next = page.getByRole('button', { name: 'Next' });
    await expect(next).toBeEnabled({ timeout: 20_000 });
    await next.click();
    await expect(denseRow).toHaveCount(0, { timeout: 20_000 });

    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(denseRow).toBeVisible({ timeout: 20_000 });
  });

  test('ALERT-3: List mode loads three 40-rule batches for a corpus-scoped filter, and a copied URL restores the filter after reload', async ({
    page,
  }) => {
    const manifest = requireCorpusManifest();

    await gotoResilient(page, '/alerting/rules/alert');
    await page.getByRole('radio', { name: 'List' }).click();

    const search = page.getByRole('textbox', { name: /search/i });
    const query = `label:e2e-corpus-run=${manifest.runMarker}`;
    await search.fill(query);
    await search.press('Enter');

    const links = page.getByRole('link', { name: new RegExp(manifest.runMarker) });
    await expect(links).toHaveCount(40, { timeout: 20_000 });

    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(links).toHaveCount(80, { timeout: 20_000 });
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(links).toHaveCount(120, { timeout: 20_000 });

    const copiedUrl = page.url();
    await gotoResilient(page, copiedUrl);
    await expect(search).toHaveValue(query, { timeout: 20_000 });
    await expect(links).toHaveCount(40, { timeout: 20_000 });
  });
});
