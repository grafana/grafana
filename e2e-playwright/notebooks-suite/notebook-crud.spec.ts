import { test, expect } from '@grafana/plugin-e2e';

import { withRowMenuOpen } from './rowMenuRetry';

// The `namespace` fixture is per-test and cannot be used in afterAll - hardcoded to match
// custom.ini's stack_id, the same way the dashboard-restore specs do.
const NAMESPACE = 'stacks-12345';
const NOTEBOOKS_API = `/apis/dashboard.grafana.app/v2beta1/namespaces/${NAMESPACE}/notebooks`;

const SUFFIX = Date.now().toString(36);

test.describe('Notebook create, rename, and delete', () => {
  // Set once the notebook's first autosave lands, so afterAll can clean it up if an assertion
  // fails before the test's own delete step runs. Cleared once that delete step succeeds.
  let notebookUid: string | undefined;

  test.afterAll(async ({ request }) => {
    if (notebookUid) {
      await request.delete(`${NOTEBOOKS_API}/${notebookUid}`);
    }
  });

  test('creates a notebook, renames it with the keyboard, and deletes it', async ({ page, selectors }) => {
    const finalTitle = `E2E Notebook CRUD ${SUFFIX}`;

    await page.goto('/notebooks');
    await page.getByTestId(selectors.pages.Notebooks.List.newButton).click();
    await page.waitForURL(/\/notebooks\/new/);

    // The notebook is only created by its first save, so add some content first, then leave edit
    // mode - a natural save point that flushes the autosave immediately rather than waiting on its
    // debounce, which would otherwise be free to fire mid-test and navigate out from under a
    // still-open title field.
    await page.getByTestId(selectors.pages.Notebooks.Item.footerAddCellButton('paragraph')).click();
    // Clicked explicitly rather than relying on the new cell's own auto-focus, so typing cannot
    // race the lazily-loaded markdown editor chunk landing focus somewhere else.
    await page.locator('.cm-content').last().click();
    await page.keyboard.type('Created by the notebook CRUD e2e test.');

    const editModeToggle = page.getByTestId(selectors.pages.Notebooks.Item.editModeToggle);
    await editModeToggle.getByTestId(selectors.components.RadioButton.option('false')).click();

    await page.waitForURL(/\/notebooks\/(?!new)[^/?]+/, { timeout: 20000 });
    notebookUid = new URL(page.url()).pathname.split('/').pop();
    expect(notebookUid).toBeTruthy();

    // Back into edit mode, now on the notebook's permanent URL, to rename it with the keyboard.
    await editModeToggle.getByTestId(selectors.components.RadioButton.option('true')).click();

    const titleTrigger = page.getByTestId(selectors.pages.Notebooks.Item.titleEditorTrigger);
    const originalTitle = (await titleTrigger.textContent())?.trim();
    expect(originalTitle).toBeTruthy();

    // Open the title field, type over it, then Escape: the field should revert to whatever the
    // title was when editing started, discarding the in-progress text rather than saving it.
    await titleTrigger.click();
    const titleInput = page.locator('#notebook-title');
    await expect(titleInput).toBeFocused();
    await titleInput.fill('Discarded by Escape');
    await titleInput.press('Escape');
    await expect(titleTrigger).toHaveText(originalTitle!);

    // Open it again and this time commit with Enter.
    await titleTrigger.click();
    await titleInput.fill(finalTitle);
    await titleInput.press('Enter');
    await expect(titleTrigger).toHaveText(finalTitle);

    // Add a tag through the document header's tag field - a custom value, created with Enter the
    // same way the field's own placeholder hint describes. The visible "Add a tag" text is the
    // select's own placeholder rendering, not a real `placeholder` attribute, so it's found by its
    // accessible name instead.
    const tagName = `e2e-crud-${SUFFIX}`;
    const tagInput = page.getByRole('combobox', { name: 'Tag filter' });
    await tagInput.click();
    await tagInput.fill(tagName);
    await tagInput.press('Enter');
    await expect(page.getByText(tagName, { exact: true })).toBeVisible();

    // The toolbar's own copy-link and kebab (export) are a second entry point to the same
    // actions the list's row menu covers elsewhere in this suite - exercised here from the item
    // page's toolbar instead.
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByText('Link copied to clipboard')).toBeVisible();

    // Unlike the list row menu (which nests these under an "Export" submenu), the toolbar's kebab
    // menu flattens the export actions directly into itself - see NotebookToolbar.tsx.
    await page.getByTestId(selectors.pages.Notebooks.Item.toolbarKebabButton).click();
    await page.getByRole('menuitem', { name: 'Copy as Markdown' }).click();
    await expect(page.getByText('Notebook copied as Markdown')).toBeVisible();

    // Flush the rename and the tag before navigating away - otherwise the debounced save can be
    // left in flight and the list below would still show the notebook's old title/tags.
    await editModeToggle.getByTestId(selectors.components.RadioButton.option('false')).click();

    // Still there once persisted and re-rendered read-only, confirming the tag actually saved
    // rather than only existing in the field's own local selection state.
    await expect(page.getByText(tagName, { exact: true })).toBeVisible();

    await page.goto('/notebooks');
    // Scoped by search rather than relying on this notebook being the newest - the pagination
    // spec's 21 concurrent creates can otherwise push it past the default first page.
    await page.getByTestId(selectors.pages.Notebooks.List.searchInput).fill(finalTitle);
    const row = page.getByTestId(selectors.pages.Notebooks.List.table.row(notebookUid!));
    await expect(row).toBeVisible();

    const rowMenuButton = page.getByTestId(selectors.pages.Notebooks.List.table.rowMenuButton(notebookUid!));
    await withRowMenuOpen(rowMenuButton, async () => {
      await page.getByTestId(selectors.pages.Notebooks.List.RowMenu.delete).click({ timeout: 5000 });
    });
    await page.getByTestId(selectors.pages.ConfirmModal.delete).click();

    await expect(row).toBeHidden();
    // The UI delete above already removed it; afterAll's cleanup is only for a failed assertion.
    notebookUid = undefined;
  });
});
