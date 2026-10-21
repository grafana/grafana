import { test, expect } from '@grafana/plugin-e2e';

import { getCorpusFolder, getPlainCorpusFolder, requireCorpusManifest } from './corpus/corpusState';
import { RuleListPage, folderScope } from './pages/RuleListPage';

// Needs `alerting-corpus-setup`; assertions are scoped to the run marker.

test.describe('Alert rules: Folders and List browsing', () => {
  test('the dense folder shows its direct Alert count, Load more reveals the rest, and a still-collapsed folder is never fetched', async ({
    page,
  }) => {
    const manifest = requireCorpusManifest();
    const dense = getCorpusFolder(manifest, manifest.denseFolderUid);
    const untouched = getPlainCorpusFolder(manifest);

    const list = new RuleListPage(page, 'alert');
    await list.gotoFolders(folderScope(dense.uid, untouched.uid));

    await expect(list.folderRow(dense.title)).toContainText(`${dense.alertRules.length} alert rules`);
    await expect(list.folderRow(untouched.title)).toContainText('1 alert rule');

    await list.toggleFolder(dense.title);
    // Rule links are told apart by the `f<folder>r<rule>` part of the title.
    const denseLinks = list
      .folderRow(dense.title)
      .getByRole('link', { name: new RegExp(`f\\d+r\\d+ ${manifest.runMarker}`) });
    await expect(denseLinks).toHaveCount(40);

    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(denseLinks).toHaveCount(dense.alertRules.length);

    expect(list.recordedSearches.length).toBeGreaterThan(0);
    expect(list.recordedSearches.some((body) => JSON.stringify(body).includes(untouched.uid))).toBe(false);
  });

  test('a nested folder shows the path of its parents', async ({ page }) => {
    const manifest = requireCorpusManifest();
    const nested = getCorpusFolder(manifest, manifest.nestedFolderUid);
    const parent = getCorpusFolder(manifest, nested.parentUid!);

    const list = new RuleListPage(page, 'alert');
    await list.gotoFolders(folderScope(nested.uid));

    await expect(list.folderRow(nested.title)).toContainText(parent.title);
  });

  test('an empty folder is not listed, and a folder with only Recording rules is, without Alert rules', async ({
    page,
  }) => {
    const manifest = requireCorpusManifest();
    const empty = getCorpusFolder(manifest, manifest.emptyFolderUid);
    const recordingOnly = getCorpusFolder(manifest, manifest.recordingOnlyFolderUid);
    const list = new RuleListPage(page, 'alert');

    await list.gotoFolders(folderScope(recordingOnly.uid));
    await expect(list.folderRow(recordingOnly.title)).toContainText('0 alert rules');

    await list.gotoFolders(folderScope(empty.uid));
    await expect(page.getByText('No alert rules match this folder')).toBeVisible();
    await expect(page.getByRole('link', { name: empty.title })).toHaveCount(0);
  });

  test('List mode loads three 40-rule batches for a corpus-scoped filter, and a copied URL restores the filter after reload', async ({
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

  test('every List row shows the full path of its folder', async ({ page }) => {
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
