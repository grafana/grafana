import { test, expect } from '@grafana/plugin-e2e';
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
function seededNotebook(title: string) {
  return {
    metadata: { generateName: 'e2e-notebook-' },
    spec: {
      title,
      tags: [],
      timeSettings: TIME_SETTINGS,
      elements: {
        'cell-1': { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'Existing content' } } } },
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

test.describe(
  'Notebook cell editing with the keyboard',
  {
    tag: ['@dashboards'],
  },
  () => {
    let uid: string;

    test.beforeAll(async ({ request }) => {
      const response = await request.post(NOTEBOOKS_API, {
        data: seededNotebook(`E2E Notebook Cell Editing ${SUFFIX}`),
      });
      expect(response.ok()).toBeTruthy();
      uid = (await response.json()).metadata.name;
    });

    test.afterAll(async ({ request }) => {
      if (uid) {
        await request.delete(`${NOTEBOOKS_API}/${uid}`);
      }
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
  }
);

test.describe(
  'Notebook cell editing with the mouse',
  {
    tag: ['@dashboards'],
  },
  () => {
    let uid: string;

    test.beforeAll(async ({ request }) => {
      const response = await request.post(NOTEBOOKS_API, {
        data: seededNotebook(`E2E Notebook Code Cell ${SUFFIX}`),
      });
      expect(response.ok()).toBeTruthy();
      uid = (await response.json()).metadata.name;
    });

    test.afterAll(async ({ request }) => {
      if (uid) {
        await request.delete(`${NOTEBOOKS_API}/${uid}`);
      }
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
  }
);
