import { test, expect } from '@grafana/plugin-e2e';

import { getCorpusFolder, getPlainCorpusFolder, requireCorpusManifest } from './corpus/corpusState';
import { RuleListPage, folderScope } from './pages/RuleListPage';

// Same corpus as gma-alert-browsing.spec.ts.

test.describe('Recording rules: Folders and List browsing', () => {
  test('the dense folder shows its direct Recording count, Load more reveals the rest, and searches are Recording-only', async ({
    page,
  }) => {
    const manifest = requireCorpusManifest();
    const dense = getCorpusFolder(manifest, manifest.denseFolderUid);
    const untouched = getPlainCorpusFolder(manifest);

    // Also record the Alert endpoint so a stray Alert search fails the test.
    const alertSearches = new RuleListPage(page, 'alert');
    const list = new RuleListPage(page, 'recording');
    await list.gotoFolders(folderScope(dense.uid, untouched.uid));

    await expect(list.folderRow(dense.title)).toContainText(`${dense.recordingRules.length} recording rules`);
    await expect(list.folderRow(untouched.title)).toContainText('1 recording rule');

    await list.toggleFolder(dense.title);
    // Rule links are told apart by the `f<folder>r<rule>` part of the title.
    const denseLinks = list
      .folderRow(dense.title)
      .getByRole('link', { name: new RegExp(`f\\d+r\\d+ ${manifest.runMarker}`) });
    await expect(denseLinks).toHaveCount(40);

    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(denseLinks).toHaveCount(dense.recordingRules.length);

    expect(alertSearches.recordedSearches).toHaveLength(0);
    expect(list.recordedSearches.some((body) => JSON.stringify(body).includes(untouched.uid))).toBe(false);
  });

  test('a nested folder shows the path of its parents', async ({ page }) => {
    const manifest = requireCorpusManifest();
    const nested = getCorpusFolder(manifest, manifest.nestedFolderUid);
    const parent = getCorpusFolder(manifest, nested.parentUid!);

    const list = new RuleListPage(page, 'recording');
    await list.gotoFolders(folderScope(nested.uid));

    await expect(list.folderRow(nested.title)).toContainText(parent.title);
  });

  test('an empty folder is not listed, and a folder with only Alert rules is, without Recording rules', async ({
    page,
  }) => {
    const manifest = requireCorpusManifest();
    const empty = getCorpusFolder(manifest, manifest.emptyFolderUid);
    const alertOnly = getCorpusFolder(manifest, manifest.alertOnlyFolderUid);
    const list = new RuleListPage(page, 'recording');

    await list.gotoFolders(folderScope(alertOnly.uid));
    await expect(list.folderRow(alertOnly.title)).toContainText('0 recording rules');

    await list.gotoFolders(folderScope(empty.uid));
    await expect(page.getByText('No recording rules match this folder')).toBeVisible();
    await expect(page.getByRole('link', { name: empty.title })).toHaveCount(0);
  });

  test('List mode loads three 40-rule batches for a corpus-scoped filter', async ({ page }) => {
    const manifest = requireCorpusManifest();

    const list = new RuleListPage(page, 'recording');
    await list.goto(`label:e2e-corpus-run=${manifest.runMarker}`);

    const links = page.getByRole('link', { name: new RegExp(manifest.runMarker) });
    await expect(links).toHaveCount(40);

    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(links).toHaveCount(80);
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(links).toHaveCount(120);
  });

  test('every List row shows the full path of its folder', async ({ page }) => {
    const manifest = requireCorpusManifest();
    const nested = getCorpusFolder(manifest, manifest.nestedFolderUid);
    const parent = getCorpusFolder(manifest, nested.parentUid!);
    const plain = getPlainCorpusFolder(manifest);

    const list = new RuleListPage(page, 'recording');
    await list.goto(folderScope(nested.uid, plain.uid));

    await expect(list.ruleRow(nested.recordingRules[0].title)).toContainText(
      new RegExp(`${parent.title}\\s*${nested.title}`)
    );
    await expect(list.ruleRow(plain.recordingRules[0].title)).toContainText(plain.title);
  });
});
