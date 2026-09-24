import { type APIRequestContext } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';
// Intentional, not a stray deviation from this suite's usual relative/@grafana/* imports:
// `yarn e2e:playwright` sets NODE_OPTIONS='-C @grafana-app/source' (locally and in CI), which
// registers the `app/` alias for Playwright's Node-side TS loader. Verified across all CI shards
// on this PR - no module-resolution error - and this file is a bare string constant with no
// further imports of its own, so it's safe to pull in this way.
import { NOTEBOOK_CELL_FRAME_CLASS } from 'app/features/notebook/scene/layout-notebook/edit/cellClassNames';

// The `namespace` fixture is per-test and cannot be used in beforeAll/afterAll - hardcoded to match
// custom.ini's stack_id, the same way the dashboard-restore specs do.
const NAMESPACE = 'stacks-12345';
const NOTEBOOKS_API = `/apis/dashboard.grafana.app/v2beta1/namespaces/${NAMESPACE}/notebooks`;

const SUFFIX = Date.now().toString(36);

const TIME_SETTINGS = {
  timezone: 'browser',
  from: 'now-6h',
  to: 'now',
  autoRefresh: '',
  autoRefreshIntervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'],
  hideTimepicker: false,
  fiscalYearStartMonth: 0,
};

/** A notebook seeded with a single existing markdown cell, for tests that add a block onto it. */
function seededNotebook(title: string, text = 'Existing content') {
  return {
    metadata: { generateName: 'e2e-notebook-' },
    spec: {
      title,
      tags: [],
      timeSettings: TIME_SETTINGS,
      elements: {
        'cell-1': { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text } } } },
      },
      layout: {
        kind: 'NotebookLayout',
        spec: {
          cells: [
            {
              kind: 'NotebookLayoutItem',
              spec: { element: { kind: 'ElementReference', name: 'cell-1' }, source: 'user' },
            },
          ],
        },
      },
    },
  };
}

/** A notebook seeded with two distinct, ordered markdown cells, for the reorder test. */
function twoCellNotebook(title: string) {
  return {
    metadata: { generateName: 'e2e-notebook-' },
    spec: {
      title,
      tags: [],
      timeSettings: TIME_SETTINGS,
      elements: {
        'cell-1': { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'First cell' } } } },
        'cell-2': { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'Second cell' } } } },
      },
      layout: {
        kind: 'NotebookLayout',
        spec: {
          cells: [
            {
              kind: 'NotebookLayoutItem',
              spec: { element: { kind: 'ElementReference', name: 'cell-1' }, source: 'user' },
            },
            {
              kind: 'NotebookLayoutItem',
              spec: { element: { kind: 'ElementReference', name: 'cell-2' }, source: 'user' },
            },
          ],
        },
      },
    },
  };
}

async function createNotebook(request: APIRequestContext, data: unknown) {
  const response = await request.post(NOTEBOOKS_API, { data });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).metadata.name as string;
}

async function deleteNotebook(request: APIRequestContext, uid: string | undefined) {
  if (uid) {
    await request.delete(`${NOTEBOOKS_API}/${uid}`);
  }
}

test.describe('Notebook cell editing with the keyboard', () => {
  let uid: string;

  test.beforeAll(async ({ request }) => {
    uid = await createNotebook(request, seededNotebook(`E2E Notebook Cell Editing ${SUFFIX}`));
  });

  test.afterAll(async ({ request }) => {
    await deleteNotebook(request, uid);
  });

  test('adds a block with the keyboard alone, and Escape leaves it untouched', async ({ page, selectors }) => {
    await page.goto(`/notebooks/${uid}?edit=true`);

    // The editor always keeps a trailing empty cell ready to type into, so a notebook seeded with
    // one non-empty cell renders two: the seeded one, plus that empty slot.
    const cellFrames = page.locator(`.${NOTEBOOK_CELL_FRAME_CLASS}`);
    await expect(cellFrames).toHaveCount(2);
    const countBeforeAdding = await cellFrames.count();

    const headingButton = page.getByTestId(selectors.pages.Notebooks.Item.footerAddCellButton('heading'));

    // Focus the button without a mouse, then Escape: nothing should be added.
    await headingButton.focus();
    await expect(headingButton).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(cellFrames).toHaveCount(countBeforeAdding);

    // Same focused button, this time activated with Enter - the native keyboard activation for a
    // button - which should append a new cell.
    await headingButton.focus();
    await page.keyboard.press('Enter');
    await expect(cellFrames).not.toHaveCount(countBeforeAdding);

    // addCell keeps the editor's own trailing empty cell at the tail, inserting the new one just
    // before it - so the new cell's editor is second-to-last, not last. Typed into directly, to
    // confirm the appended cell is actually editable and not just present.
    const newCellEditor = page.locator('.cm-content').nth(countBeforeAdding - 1);
    await newCellEditor.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Heading added by keyboard');
    await expect(newCellEditor).toContainText('Heading added by keyboard');
  });
});

test.describe('Notebook cell editing with the mouse', () => {
  let uid: string;

  test.beforeAll(async ({ request }) => {
    uid = await createNotebook(request, seededNotebook(`E2E Notebook Code Cell ${SUFFIX}`));
  });

  test.afterAll(async ({ request }) => {
    await deleteNotebook(request, uid);
  });

  test('adds a code block from the hover-revealed add button, types code, and changes its language', async ({
    page,
  }) => {
    await page.goto(`/notebooks/${uid}?edit=true`);

    // The per-cell "add block" button only reveals on hover (or focus-within) of its own cell frame
    // - hovering the frame first is what makes it actionable at all.
    const firstCellFrame = page.locator(`.${NOTEBOOK_CELL_FRAME_CLASS}`).first();
    await firstCellFrame.hover();
    await firstCellFrame.getByRole('button', { name: 'Click to add below' }).click();
    await page.getByRole('menuitem', { name: 'Code' }).click();

    // The only code cell on the page, so its language combobox picks it out unambiguously
    // regardless of where in the cell list it landed.
    const codeCellFrame = page
      .locator(`.${NOTEBOOK_CELL_FRAME_CLASS}`)
      .filter({ has: page.getByRole('combobox', { name: 'Code language' }) });
    const codeEditor = codeCellFrame.locator('.cm-content');
    const languagePicker = codeCellFrame.getByRole('combobox', { name: 'Code language' });

    await codeEditor.click();
    await page.keyboard.type('SELECT 1');
    await expect(codeEditor).toContainText('SELECT 1');

    await languagePicker.click();
    await page.getByRole('option', { name: 'SQL' }).click();
    await expect(languagePicker).toHaveValue('SQL');
  });
});

test.describe('Notebook cell duplicate and delete', () => {
  let uid: string;

  test.beforeAll(async ({ request }) => {
    uid = await createNotebook(request, seededNotebook(`E2E Notebook Cell Actions ${SUFFIX}`));
  });

  test.afterAll(async ({ request }) => {
    await deleteNotebook(request, uid);
  });

  test('duplicates a cell via hover-revealed actions, then deletes the duplicate', async ({ page }) => {
    await page.goto(`/notebooks/${uid}?edit=true`);

    const cellFrames = page.locator(`.${NOTEBOOK_CELL_FRAME_CLASS}`);
    await expect(cellFrames).toHaveCount(2);

    // Duplicate inserts directly below the original, so it lands at index 1 - between the seeded
    // cell and the editor's own trailing empty slot.
    const firstCellFrame = cellFrames.first();
    await firstCellFrame.hover();
    await firstCellFrame.getByRole('button', { name: 'Duplicate block' }).click();
    await expect(cellFrames).toHaveCount(3);
    await expect(page.locator('.cm-content').nth(1)).toContainText('Existing content');

    // Delete the duplicate specifically (not the original) - it asks for confirmation first.
    const duplicateFrame = cellFrames.nth(1);
    await duplicateFrame.hover();
    await duplicateFrame.getByRole('button', { name: 'Delete block' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(cellFrames).toHaveCount(2);
    await expect(page.locator('.cm-content').first()).toContainText('Existing content');
  });
});

test.describe('Notebook block type menu', () => {
  let slashUid: string;
  let vizUid: string;

  test.beforeAll(async ({ request }) => {
    // An empty seed cell, so its content is exactly "" and typing "/" into it hits the slash-menu
    // trigger rather than appending to existing text.
    slashUid = await createNotebook(request, seededNotebook(`E2E Notebook Slash Menu ${SUFFIX}`, ''));
    vizUid = await createNotebook(request, seededNotebook(`E2E Notebook Visualization ${SUFFIX}`));
  });

  test.afterAll(async ({ request }) => {
    await deleteNotebook(request, slashUid);
    await deleteNotebook(request, vizUid);
  });

  test('converts an empty cell to code by typing "/"', async ({ page }) => {
    await page.goto(`/notebooks/${slashUid}?edit=true`);

    await page.locator('.cm-content').first().click();
    await page.keyboard.type('/');

    // The slash-menu is the same NotebookBlockTypeMenu the hover add-button opens, but rendered
    // through a Portal - not a descendant of the cell, so it has to be found globally.
    await page.getByRole('menuitem', { name: 'Code' }).click();

    await expect(
      page
        .locator(`.${NOTEBOOK_CELL_FRAME_CLASS}`)
        .filter({ has: page.getByRole('combobox', { name: 'Code language' }) })
    ).toBeVisible();
  });

  test('adds a visualization block from the footer button', async ({ page, selectors }) => {
    await page.goto(`/notebooks/${vizUid}?edit=true`);

    const cellFrames = page.locator(`.${NOTEBOOK_CELL_FRAME_CLASS}`);
    await expect(cellFrames).toHaveCount(2);
    const countBeforeAdding = await cellFrames.count();

    await page.getByTestId(selectors.pages.Notebooks.Item.footerAddCellButton('visualization')).click();

    await expect(cellFrames).toHaveCount(3);

    // addCell inserts just before the editor's own trailing empty slot, not at the very end - see
    // the same note in the keyboard test above. panelCell is keyed by the cell's generated
    // elementName, which the test has no way to predict, so it's matched by prefix instead and
    // scoped to this specific cell frame rather than assuming it's the only panel on the page.
    const newCellFrame = cellFrames.nth(countBeforeAdding - 1);
    await expect(newCellFrame.locator('[data-testid^="data-testid notebooks item panel-cell"]')).toBeVisible();
  });
});

test.describe('Notebook undo and redo', () => {
  let uid: string;

  test.beforeAll(async ({ request }) => {
    uid = await createNotebook(request, seededNotebook(`E2E Notebook Undo Redo ${SUFFIX}`));
  });

  test.afterAll(async ({ request }) => {
    await deleteNotebook(request, uid);
  });

  test('undoes an added block with the keyboard, then redoes it by clicking the button', async ({
    page,
    selectors,
  }) => {
    await page.goto(`/notebooks/${uid}?edit=true`);

    const cellFrames = page.locator(`.${NOTEBOOK_CELL_FRAME_CLASS}`);
    await expect(cellFrames).toHaveCount(2);

    const redoButton = page.getByRole('button', { name: /^Redo/ });
    await expect(redoButton).toBeDisabled();

    await page.getByTestId(selectors.pages.Notebooks.Item.footerAddCellButton('paragraph')).click();
    await expect(cellFrames).toHaveCount(3);

    // Either modifier is accepted by the app's own shortcut handler, so Control+z works
    // regardless of host OS convention.
    await page.keyboard.press('Control+z');
    await expect(cellFrames).toHaveCount(2);
    await expect(redoButton).toBeEnabled();

    await redoButton.click();
    await expect(cellFrames).toHaveCount(3);
  });
});

test.describe('Notebook drag-to-reorder', () => {
  let uid: string;

  test.beforeAll(async ({ request }) => {
    uid = await createNotebook(request, twoCellNotebook(`E2E Notebook Reorder ${SUFFIX}`));
  });

  test.afterAll(async ({ request }) => {
    await deleteNotebook(request, uid);
  });

  test('reorders two cells with the keyboard drag handle', async ({ page }) => {
    await page.goto(`/notebooks/${uid}?edit=true`);

    const firstEditor = page.locator('.cm-content').first();
    await expect(firstEditor).toContainText('First cell');

    const firstHandle = page.getByRole('button', { name: 'Drag to reorder' }).first();
    await firstHandle.focus();
    await page.keyboard.press('Space');
    await expect(page.getByText(/you have lifted/i)).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await expect(page.getByText(/you have moved the item/i)).toBeVisible();

    await page.keyboard.press('Space');
    await expect(page.getByText(/you have dropped the item/i)).toBeVisible();

    await expect(firstEditor).toContainText('Second cell');
    await expect(page.locator('.cm-content').nth(1)).toContainText('First cell');
  });
});
