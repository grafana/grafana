import { test, expect } from '@grafana/plugin-e2e';

// `page`/`request` fixtures using the current org's namespace, such as the `namespace` fixture, are
// per-test and cannot be used in beforeAll/afterAll - hardcoded to match custom.ini's stack_id, the
// same way the dashboard-restore specs do.
const NAMESPACE = 'stacks-12345';
const NOTEBOOKS_API = `/apis/dashboard.grafana.app/v2beta1/namespaces/${NAMESPACE}/notebooks`;

const SUFFIX = Date.now().toString(36);

const TITLE_A = `E2E Notebook Alpha ${SUFFIX}`;
const TITLE_B = `E2E Notebook Beta ${SUFFIX}`;
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

test.describe(
  'Notebooks list search and tag filter',
  {
    tag: ['@dashboards'],
  },
  () => {
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

      const rowA = page.getByTestId(selectors.pages.Notebooks.List.table.row(TITLE_A));
      const rowB = page.getByTestId(selectors.pages.Notebooks.List.table.row(TITLE_B));
      await expect(rowA).toBeVisible();
      await expect(rowB).toBeVisible();

      // Search narrows to the title that matches; the other notebook drops out of the list.
      const searchInput = page.getByTestId(selectors.pages.Notebooks.List.searchInput);
      await searchInput.fill('Alpha');
      await expect(rowA).toBeVisible();
      await expect(rowB).toBeHidden();

      await searchInput.fill('');
      await expect(rowA).toBeVisible();
      await expect(rowB).toBeVisible();

      // Clicking a notebook's own tag chip filters the list down to that tag.
      await page.getByRole('button', { name: `Filter by tag ${TAG_A}` }).click();
      await expect(rowA).toBeVisible();
      await expect(rowB).toBeHidden();
    });
  }
);
