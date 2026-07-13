import { test, expect } from '@grafana/plugin-e2e';

import testDashboard from '../dashboards/PinnedFiltersTest.json';
import { getCell } from '../panels-suite/table-utils';

const fixture = require('../fixtures/prometheus-response.json');

const LABELS = ['slice', 'job', 'instance'];
const SLICE_VALUES = ['inner_eval', 'prepare_time'];
const JOB_VALUES_ALL = ['job_a', 'job_b'];
const JOB_VALUES_FOR_INNER_EVAL = ['job_a'];

test.describe(
  'Dashboard with pinned ad hoc filters (grafana.pinnedFilters)',
  {
    tag: ['@dashboards'],
  },
  () => {
    // Both tests share one imported dashboard; run serially so a parallel worker's
    // afterAll cleanup cannot race with the other test's import.
    test.describe.configure({ mode: 'serial' });

    let dashboardUID: string;

    test.beforeAll(async ({ request }) => {
      const response = await request.post('/api/dashboards/import', {
        data: {
          dashboard: testDashboard,
          folderUid: '',
          overwrite: true,
          inputs: [],
        },
      });
      expect(response.ok()).toBeTruthy();
      const responseBody = await response.json();
      dashboardUID = responseBody.uid;
      expect(dashboardUID).toBeTruthy();
    });

    test.afterAll(async ({ request }) => {
      if (dashboardUID) {
        await request.delete(`/api/dashboards/uid/${dashboardUID}`);
      }
    });

    test.beforeEach(async ({ page }) => {
      // Enable the grafana.pinnedFilters OpenFeature flag through the localStorage provider,
      // which takes precedence over the backend (OFREP) provider.
      await page.addInitScript(() => {
        window.localStorage.setItem('grafana.openfeature.grafana.pinnedFilters', 'true');
      });

      // Mock the Prometheus label APIs so key/value suggestions (and their cascading behavior)
      // work without a live Prometheus.
      await page.route(/\/resources\/api\/v1\/status\/buildinfo/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', data: { version: '2.51.0' } }),
        });
      });

      await page.route(/\/resources\/api\/v1\/labels/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', data: LABELS }),
        });
      });

      await page.route(/\/resources\/api\/v1\/label\/slice\/values/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', data: SLICE_VALUES }),
        });
      });

      await page.route(/\/resources\/api\/v1\/label\/job\/values/, async (route) => {
        // Cascading: when the request is constrained by a slice matcher, return a narrowed list
        const url = decodeURIComponent(route.request().url());
        const values = url.includes('inner_eval') ? JOB_VALUES_FOR_INNER_EVAL : JOB_VALUES_ALL;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', data: values }),
        });
      });

      await page.route(/\/resources\/api\/v1\/series/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', data: [] }),
        });
      });

      // Mock the query API: simulate Prometheus applying a slice label matcher by dropping
      // non-matching dataframes from the fixture response.
      await page.route(/\/api\/ds\/query/, async (route) => {
        const response = JSON.parse(JSON.stringify(fixture));

        const postData = route.request().postData();
        // Filters are injected into the query expression, e.g. {slice="inner_eval"} or
        // {slice=~"inner_eval|prepare_time"}. A match-all matcher ({slice=~".*"}) is a no-op.
        const match = postData?.match(/slice=~?\\"([^"\\]+)\\"/);
        if (match && match[1] !== '.*') {
          const allowed = match[1].split('|');
          response.results.A.frames = response.results.A.frames.filter(
            (frame: { schema: { fields: Array<{ labels?: Record<string, string> }> } }) =>
              frame.schema.fields.every((field) => !field.labels || allowed.includes(field.labels.slice))
          );
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response),
        });
      });
    });

    test('Pinned filters render as standalone controls, cascade, and are populated by panel clicks', async ({
      page,
      gotoDashboardPage,
      selectors,
    }) => {
      const dashboardPage = await gotoDashboardPage({ uid: dashboardUID });

      const panel = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.title('Table powered by Prometheus')
      );
      await expect(panel, 'panel is rendered').toBeVisible();

      const table = panel.locator('.rdg');
      await expect(table, 'table is rendered').toBeVisible();

      // Both pinned filters render as standalone labeled controls
      const sliceControl = page.getByTestId('pinned-filter-slice');
      const jobControl = page.getByTestId('pinned-filter-job');
      await expect(sliceControl, 'Slice pinned control is visible').toBeVisible();
      await expect(sliceControl).toContainText('Slice');
      await expect(jobControl, 'Job pinned control is visible').toBeVisible();
      await expect(jobControl).toContainText('Job');

      // No pills rendered for pinned filters in the bulk combobox
      await expect(page.getByLabel(/Edit filter with key/)).toBeHidden();

      // Bulk filter key suggestions exclude pinned keys
      const bulkInput = page.getByPlaceholder('+ label = value');
      await bulkInput.click();
      const listbox = page.getByRole('listbox');
      await expect(listbox.getByRole('option', { name: 'instance', exact: true })).toBeVisible();
      await expect(listbox.getByRole('option', { name: 'slice', exact: true })).toBeHidden();
      await expect(listbox.getByRole('option', { name: 'job', exact: true })).toBeHidden();
      await page.keyboard.press('Escape');

      // Both fixture rows are visible before filtering
      await expect(table.getByText(SLICE_VALUES[0])).toBeVisible();
      await expect(table.getByText(SLICE_VALUES[1])).toBeVisible();

      // Selecting a value in the Slice pinned control filters the panel
      await sliceControl.getByTestId('pinned-filter-value-slice').click();
      await page.getByRole('option', { name: SLICE_VALUES[0] }).click();
      await page.keyboard.press('Escape');

      await expect(table.getByText(SLICE_VALUES[0]), 'selected slice remains visible').toBeVisible();
      await expect(table.getByText(SLICE_VALUES[1]), 'other slice is filtered out').toBeHidden();

      // The pinned selection is synced to the URL (restorable dashboard-origin filter)
      await expect(async () => {
        const promAdHocParam = new URLSearchParams(new URL(page.url()).search).get('var-PromAdHoc');
        expect(promAdHocParam).toContain(SLICE_VALUES[0]);
        expect(promAdHocParam).toContain('restorable');
      }).toPass();

      // Cascading: Job pinned control options are constrained by the Slice selection
      await jobControl.getByTestId('pinned-filter-value-job').click();
      await expect(page.getByRole('option', { name: JOB_VALUES_FOR_INNER_EVAL[0], exact: true })).toBeVisible();
      await expect(page.getByRole('option', { name: JOB_VALUES_ALL[1], exact: true })).toBeHidden();
      await page.keyboard.press('Escape');

      // Restore the Slice pinned filter back to All
      await sliceControl.getByRole('button', { name: /Restore Slice/ }).click();
      await expect(table.getByText(SLICE_VALUES[1]), 'other slice is back after restore').toBeVisible();

      // Panel-to-panel filtering: "Filter for value" on a pinned field populates the pinned
      // control instead of adding a bulk filter pill
      const targetCell = table.getByText(SLICE_VALUES[1]);
      await targetCell.hover();
      await targetCell.getByRole('button', { name: 'Filter for value' }).click();

      await expect(sliceControl, 'pinned control shows the clicked value').toContainText(SLICE_VALUES[1]);
      await expect(page.getByLabel(/Remove filter with key/), 'no bulk filter pill was added').toBeHidden();

      await expect(table.getByText(SLICE_VALUES[1]), 'clicked slice remains visible').toBeVisible();
      await expect(table.getByText(SLICE_VALUES[0]), 'other slice is filtered out by panel click').toBeHidden();
    });

    test('Pinned filters editor replaces default filters editor in dashboard edit pane', async ({
      page,
      gotoDashboardPage,
    }) => {
      await gotoDashboardPage({ uid: dashboardUID });

      await page.getByRole('button', { name: 'Enter edit mode' }).click();

      // Select the filter variable in the edit pane sidebar to open its options
      await page.getByRole('button', { name: 'Options', exact: true }).click();
      await page.getByTestId('filter-name').filter({ hasText: 'PromAdHoc' }).click();

      await expect(page.getByTestId('pinned-filters-editor')).toBeVisible();
      await expect(page.getByTestId('pinned-filters-editor-row-slice')).toBeVisible();
      await expect(page.getByTestId('pinned-filters-editor-row-job')).toBeVisible();
      await expect(page.getByText('Default filters', { exact: true })).toBeHidden();
    });
  }
);
