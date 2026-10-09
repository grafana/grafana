import { type Download } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

import { withRowMenuOpen } from './rowMenuRetry';

// Mirrors ROWS_PER_PAGE from NotebooksTable.tsx - not imported directly, since that file (unlike
// the bare-constants modules this suite does safely import from `app/`) pulls in `@grafana/data`'s
// dateTimeFormat, which reaches the same moment/luxon `declare` field interop crash under
// Playwright's Node-side loader that MARKDOWN_FORMAT_TOOLBAR_TEST_ID hit earlier in this suite.
const ROWS_PER_PAGE = 20;

// `page`/`request` fixtures using the current org's namespace, such as the `namespace` fixture, are
// per-test and cannot be used in beforeAll/afterAll - hardcoded to match custom.ini's stack_id, the
// same way the dashboard-restore specs do.
const NAMESPACE = 'stacks-12345';
const NOTEBOOKS_API = `/apis/dashboard.grafana.app/v2beta1/namespaces/${NAMESPACE}/notebooks`;

const SUFFIX = Date.now().toString(36);

// "Filter" is the shared scoping term used to isolate these two rows below - "Alpha" would also
// match "AlphaBeta"-style overlaps, so it's kept out of both titles' shared substring.
const TITLE_A = `E2E Notebook Alpha Filter ${SUFFIX}`;
const TITLE_B = `E2E Notebook Beta Filter ${SUFFIX}`;
const TAG_A = `e2e-alpha-${SUFFIX}`;

function notebookResource(title: string, tags: string[]) {
  return {
    metadata: { generateName: 'e2e-notebook-' },
    spec: {
      title,
      tags,
      timeSettings: {
        timezone: 'browser',
        from: 'now-6h',
        to: 'now',
        autoRefresh: '',
        autoRefreshIntervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'],
        hideTimepicker: false,
        fiscalYearStartMonth: 0,
      },
      elements: {},
      layout: { kind: 'NotebookLayout', spec: { cells: [] } },
    },
  };
}

test.describe('Notebooks list search and tag filter', () => {
  let uidA: string;
  let uidB: string;

  test.beforeAll(async ({ request }) => {
    const responseA = await request.post(NOTEBOOKS_API, { data: notebookResource(TITLE_A, [TAG_A]) });
    expect(responseA.ok()).toBeTruthy();
    uidA = (await responseA.json()).metadata.name;

    const responseB = await request.post(NOTEBOOKS_API, { data: notebookResource(TITLE_B, []) });
    expect(responseB.ok()).toBeTruthy();
    uidB = (await responseB.json()).metadata.name;
  });

  test.afterAll(async ({ request }) => {
    await Promise.all([uidA, uidB].filter(Boolean).map((uid) => request.delete(`${NOTEBOOKS_API}/${uid}`)));
  });

  test('filters the list by search text and by clicking a row tag', async ({ page, selectors }) => {
    await page.goto('/notebooks');

    const rowA = page.getByTestId(selectors.pages.Notebooks.List.table.row(uidA));
    const rowB = page.getByTestId(selectors.pages.Notebooks.List.table.row(uidB));
    // A search/tag change goes through an intermediate "nothing loaded yet" render before the
    // real result lands. Asserting only rowA visible / rowB hidden can pass during that gap
    // (both hidden) without ever checking what the server actually returned - the exact count
    // forces waiting for the real, settled result instead.
    const matchingRows = page.locator('[data-testid^="data-testid notebooks list row "]');

    // Scoped to "Filter" throughout rather than ever going fully unfiltered - other specs'
    // notebooks running concurrently against the same server can otherwise push these two past
    // the default page's row limit.
    const searchInput = page.getByTestId(selectors.pages.Notebooks.List.searchInput);
    await searchInput.fill('Filter');
    await expect(matchingRows).toHaveCount(2);
    await expect(rowA).toBeVisible();
    await expect(rowB).toBeVisible();

    // Search narrows to the title that matches; the other notebook drops out of the list.
    await searchInput.fill('Alpha');
    await expect(matchingRows).toHaveCount(1);
    await expect(rowA).toBeVisible();

    await searchInput.fill('Filter');
    await expect(matchingRows).toHaveCount(2);

    // Clicking a notebook's own tag chip filters the list down to that tag.
    await page.getByRole('button', { name: `Filter by tag ${TAG_A}` }).click();
    await expect(matchingRows).toHaveCount(1);
    await expect(rowA).toBeVisible();
  });
});

test.describe('Notebooks list row menu: copy link and export', () => {
  let uid: string;
  const title = `E2E Notebook Row Menu ${SUFFIX}`;

  test.beforeAll(async ({ request }) => {
    const response = await request.post(NOTEBOOKS_API, { data: notebookResource(title, []) });
    expect(response.ok()).toBeTruthy();
    uid = (await response.json()).metadata.name;
  });

  test.afterAll(async ({ request }) => {
    if (uid) {
      await request.delete(`${NOTEBOOKS_API}/${uid}`);
    }
  });

  test('copies a link, copies as markdown, and downloads as markdown', async ({ page, selectors }) => {
    await page.goto('/notebooks');
    // Scoped to just this notebook - other specs' notebooks (e.g. the pagination test's 21 rows)
    // can otherwise push it past the default unfiltered first page.
    await page.getByTestId(selectors.pages.Notebooks.List.searchInput).fill(title);
    const row = page.getByTestId(selectors.pages.Notebooks.List.table.row(uid));
    await expect(row).toBeVisible();

    const rowMenuButton = page.getByTestId(selectors.pages.Notebooks.List.table.rowMenuButton(uid));

    await withRowMenuOpen(rowMenuButton, async () => {
      await page.getByTestId(selectors.pages.Notebooks.List.RowMenu.copyLink).click({ timeout: 5000 });
    });
    await expect(page.getByText('Link copied to clipboard')).toBeVisible();

    await withRowMenuOpen(rowMenuButton, async () => {
      await page.getByRole('menuitem', { name: 'Export' }).hover({ timeout: 5000 });
      await page.getByRole('menuitem', { name: 'Copy as Markdown' }).click({ timeout: 5000 });
    });
    await expect(page.getByText('Notebook copied as Markdown')).toBeVisible();

    let download: Download | undefined;
    await withRowMenuOpen(rowMenuButton, async () => {
      await page.getByRole('menuitem', { name: 'Export' }).hover({ timeout: 5000 });
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
      await page.getByRole('menuitem', { name: 'Download as .md' }).click({ timeout: 5000 });
      download = await downloadPromise;
    });
    expect(download!.suggestedFilename()).toMatch(/\.md$/);
  });
});

test.describe('Notebooks list pagination', () => {
  const pagePrefix = `E2E Notebook Page ${SUFFIX}`;
  // One more than a full page, so exactly two pages render - page buttons "1" and "2" plus
  // prev/next, nothing to condense.
  const PAGE_TEST_NOTEBOOK_COUNT = ROWS_PER_PAGE + 1;
  let uids: string[] = [];

  test.beforeAll(async ({ request }) => {
    uids = await Promise.all(
      Array.from({ length: PAGE_TEST_NOTEBOOK_COUNT }, async (_, i) => {
        const response = await request.post(NOTEBOOKS_API, {
          data: notebookResource(`${pagePrefix} ${i}`, []),
        });
        expect(response.ok()).toBeTruthy();
        return (await response.json()).metadata.name;
      })
    );
  });

  test.afterAll(async ({ request }) => {
    await Promise.all(uids.map((uid) => request.delete(`${NOTEBOOKS_API}/${uid}`)));
  });

  test('shows a second page once more than one page of notebooks match the filter', async ({ page, selectors }) => {
    await page.goto('/notebooks');
    // Scoped to just this test's own rows - other specs' notebooks may exist in the list at the
    // same time, since Playwright runs spec files against the same server concurrently.
    await page.getByTestId(selectors.pages.Notebooks.List.searchInput).fill(pagePrefix);

    // Not asserting any specific row here: sort is newest-updated-first, and all
    // PAGE_TEST_NOTEBOOK_COUNT notebooks are created within the same second, so which one lands
    // on page 2 isn't fixed. The page-2 button appearing is the actual point of this test.
    const pageTwoButton = page.getByRole('button', { name: '2', exact: true });
    await expect(pageTwoButton).toBeVisible();

    await pageTwoButton.click();
    await expect(pageTwoButton).toHaveAttribute('aria-current', 'page');

    await page.getByRole('button', { name: '1', exact: true }).click();
    await expect(page.getByRole('button', { name: '1', exact: true })).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('Notebooks list created-by-me filter', () => {
  test('scopes the search request to the current user when checked', async ({ page, selectors }) => {
    await page.goto('/notebooks');

    // A single active filter flattens `where` to one leaf rather than wrapping it in `and`.
    function hasCreatedByFilter(body: {
      where?: { and?: Array<{ filter?: { field?: string } }> } & { filter?: { field?: string } };
    }) {
      const leaves = body.where?.and ?? (body.where ? [body.where] : []);
      return leaves.some((leaf) => leaf.filter?.field === 'createdBy');
    }

    // Every notebook in this suite is created by the same admin user, so which rows are on
    // screen can't tell "created by me" apart from "everyone" - checked at the request level
    // instead, against the search API's own vocabulary for the filter. Matched on the actual
    // `where` shape, not just timing or a raw string search: this list keeps paging through
    // unrelated (unfiltered) requests in the background as long as more pages exist, and every
    // request - filtered or not - always lists `createdBy` among the return `fields`, so a plain
    // substring match on the body would catch those too.
    const searchRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/notebooks/search') &&
        request.method() === 'POST' &&
        hasCreatedByFilter(request.postDataJSON())
    );
    // grafana-ui's Checkbox renders its label text as a sibling span overlapping the input's own
    // hit area (native <label> semantics still route the click correctly) - force is the
    // established pattern for this component elsewhere in the suite, e.g. migrate-to-cloud.spec.ts.
    await page.getByTestId(selectors.pages.Notebooks.List.createdByMeCheckbox).check({ force: true });
    const body = (await searchRequest).postDataJSON();
    expect(hasCreatedByFilter(body)).toBe(true);
  });
});
