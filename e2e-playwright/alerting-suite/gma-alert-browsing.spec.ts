import { test, expect } from '@grafana/plugin-e2e';

import { getCorpusFolder, getPlainCorpusFolder, requireCorpusManifest } from './corpus/corpusState';
import { RuleListPage, folderScope } from './pages/RuleListPage';

// Depends on the shared corpus (see playwright.config.ts `alerting-corpus-setup`/`-teardown`): run
// this spec's project with `alerting-corpus-setup` as a dependency so the manifest exists before
// these run. Every assertion is scoped to the run marker, to the manifest's own folders, or to a
// folder filter on them - never an organization-wide total or an unfiltered folder page, since other
// tests and pre-existing data share this instance. Folder Previous/Next has its own organization
// (gma-folder-pagination.spec.ts) for the same reason.

test.describe('Alert rules: Folders and List browsing', () => {
  test('ALERT-1/2: the dense folder shows its direct Alert count, Load more reveals the rest, and a still-collapsed folder is never fetched', async ({
    page,
  }) => {
    const manifest = requireCorpusManifest();
    const dense = getCorpusFolder(manifest, manifest.denseFolderUid);
    const untouched = getPlainCorpusFolder(manifest);

    const searchRequestBodies: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/alertrules/searchRules')) {
        searchRequestBodies.push(request.postData() ?? '');
      }
    });

    // Scoping Folders mode to these two folders keeps the untouched one on the page, collapsed.
    const list = new RuleListPage(page, 'alert');
    await list.gotoFolders(folderScope(dense.uid, untouched.uid));

    await expect(list.folderRow(dense.title)).toContainText(`${dense.alertRules.length} alert rules`);
    await expect(list.folderRow(untouched.title)).toContainText('1 alert rule');

    await list.toggleFolder(dense.title);
    const denseLinks = page.getByRole('link', { name: new RegExp(manifest.runMarker) });
    await expect(denseLinks).toHaveCount(40);

    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(denseLinks).toHaveCount(dense.alertRules.length);

    expect(searchRequestBodies.length).toBeGreaterThan(0);
    expect(searchRequestBodies.some((body) => body.includes(untouched.uid))).toBe(false);
  });

  test('ALERT-1: a nested folder shows the path of its parents', async ({ page }) => {
    const manifest = requireCorpusManifest();
    const nested = getCorpusFolder(manifest, manifest.nestedFolderUid);
    const parent = getCorpusFolder(manifest, nested.parentUid!);

    const list = new RuleListPage(page, 'alert');
    await list.gotoFolders(folderScope(nested.uid));

    await expect(list.folderRow(nested.title)).toContainText(parent.title);
  });

  test('ALERT-1: an empty folder is not listed, and a folder with only Recording rules is, without Alert rules', async ({
    page,
  }) => {
    const manifest = requireCorpusManifest();
    const empty = getCorpusFolder(manifest, manifest.emptyFolderUid);
    const recordingOnly = getCorpusFolder(manifest, manifest.recordingOnlyFolderUid);
    const list = new RuleListPage(page, 'alert');

    await list.gotoFolders(folderScope(recordingOnly.uid));
    await expect(list.folderRow(recordingOnly.title)).toContainText('0 alert rules');

    await list.gotoFolders(folderScope(empty.uid));
    await expect(page.getByText('No folders found')).toBeVisible();
    await expect(page.getByRole('link', { name: empty.title })).toHaveCount(0);
  });

  test('ALERT-3: List mode loads three 40-rule batches for a corpus-scoped filter, and a copied URL restores the filter after reload', async ({
    page,
  }) => {
    const manifest = requireCorpusManifest();
    const query = `label:e2e-corpus-run=${manifest.runMarker}`;

    const list = new RuleListPage(page, 'alert');
    await list.goto(query);

    const links = page.getByRole('link', { name: new RegExp(manifest.runMarker) });
    await expect(links).toHaveCount(40);

    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(links).toHaveCount(80);
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(links).toHaveCount(120);

    const copiedUrl = page.url();
    await page.goto(copiedUrl);
    await expect(list.searchInput).toHaveValue(query);
    await expect(links).toHaveCount(40);
  });

  test('ALERT-3: every List row shows the full path of its folder', async ({ page }) => {
    const manifest = requireCorpusManifest();
    const nested = getCorpusFolder(manifest, manifest.nestedFolderUid);
    const parent = getCorpusFolder(manifest, nested.parentUid!);
    const plain = getPlainCorpusFolder(manifest);

    const list = new RuleListPage(page, 'alert');
    await list.goto(folderScope(nested.uid, plain.uid));

    await expect(list.ruleRow(nested.alertRules[0].title)).toContainText(
      new RegExp(`${parent.title}\\s*${nested.title}`)
    );
    await expect(list.ruleRow(plain.alertRules[0].title)).toContainText(plain.title);
  });
});
