import { selectors } from '@grafana/e2e-selectors';

import v2DashboardWithTabsForSlug from '../dashboards/V2DashboardWithTabsForSlugTest.json';

import { test, expect } from './fixtures';
import { flows } from './helpers';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
});

function buildDashboardPathWithSearch(dashboardUid: string, searchParams: Record<string, string>): string {
  const base = new URL(`http://grafana.test/d/${dashboardUid}`);
  for (const [key, value] of Object.entries(searchParams)) {
    base.searchParams.set(key, value);
  }
  return `${base.pathname}${base.search}`;
}

const testCases: Array<{
  description: string;
  searchParams: Record<string, string>;
  expectedSelectedTab: string;
  /** Scope tab selection assertion to this row when the same tab title can appear in multiple rows */
  rowTitle?: string;
}> = [
  {
    description: 'nested row: selects tab when its URL key matches canonical tab slug (non-legacy)',
    searchParams: { 'Overview-dtab': 'Logs' },
    expectedSelectedTab: 'Logs',
    rowTitle: 'Overview',
  },
  {
    description: 'nested row: selects tab when url key uses punctuation in row title and tab slug',
    searchParams: { 'ERRORS-slo!-dtab': 'Bugs-Fixed!!!' },
    expectedSelectedTab: 'Bugs Fixed!!!',
    rowTitle: 'ERRORS slo!',
  },
  {
    description: 'nested row: legacy slug in URL still resolves the correct tab',
    searchParams: { 'errors-slo-dtab': 'bugs-fixed' },
    expectedSelectedTab: 'Bugs Fixed!!!',
    rowTitle: 'ERRORS slo!',
  },
  {
    description:
      'nested row: prefers canonical query key when both canonical and legacy tab names are present in the layout',
    searchParams: {
      'SUCCESS-slo!-dtab': 'Bugs-Fixed!!',
    },
    expectedSelectedTab: 'Bugs Fixed!!',
    rowTitle: 'SUCCESS slo!',
  },
  {
    description:
      'nested row: empty canonical tab param skips to legacy key (TabsLayoutManager getSlug / updateFromUrl)',
    searchParams: {
      'ERRORS-slo!-dtab': '',
      'errors-slo-dtab': 'perfzk',
    },
    expectedSelectedTab: 'PerfZk',
    rowTitle: 'ERRORS slo!',
  },
  {
    description: 'nested row: disambiguated tab slug (with suffix) selects the second tab',
    searchParams: { 'ERRORS-slo!-dtab': 'New-tab__2' },
    expectedSelectedTab: 'New-tab',
    rowTitle: 'ERRORS slo!',
  },
  {
    description: 'nested row: tab title with ampersand matches canonical slug in URL',
    searchParams: { 'Overview-dtab': 'Metrics&Traces' },
    expectedSelectedTab: 'Metrics&Traces',
    rowTitle: 'Overview',
  },
  {
    description: 'unknown URL keys do not change the default tab selection',
    searchParams: { 'not-a-tabs-layout-sync-key': 'any-value' },
    expectedSelectedTab: 'Logs',
    rowTitle: 'Overview',
  },
];

test.describe(
  'Syncing URL with dashboard state',
  {
    tag: ['@dashboards'],
  },
  () => {
    // One import for the whole file: each test only changes the query string on the same dashboard
    test.describe.configure({ mode: 'serial' });

    let dashboardUid: string;

    test.beforeAll(async ({ browser, baseURL }) => {
      const page = await browser.newPage({ baseURL });
      try {
        await flows.dashboards.importTestDashboard(
          page,
          selectors,
          'url-sync-tabs-test',
          JSON.stringify(v2DashboardWithTabsForSlug)
        );
        const match = page.url().match(/\/d\/([^/?]+)/);
        dashboardUid = match![1];
      } finally {
        await page.close();
      }
    });

    for (const testCase of testCases) {
      test(testCase.description, async ({ page, rows, tabs }) => {
        await page.goto(buildDashboardPathWithSearch(dashboardUid, testCase.searchParams));

        const tabLocator = testCase.rowTitle
          ? tabs.getTitle(testCase.expectedSelectedTab, rows.getContent(testCase.rowTitle))
          : tabs.getTitle(testCase.expectedSelectedTab);

        await expect(tabLocator).toHaveAttribute('aria-selected', 'true');
      });
    }
  }
);

test(
  'can bookmark top-level and nested tabs and navigate their browser history',
  { tag: ['@dashboards'] },
  async ({ page, context, tabs, rows, selectors: e2eSelectors }) => {
    const dashboard = {
      ...v2DashboardWithTabsForSlug,
      spec: {
        ...v2DashboardWithTabsForSlug.spec,
        // Keep the existing nested tabs and give them a top-level tab alongside a separate summary.
        layout: {
          kind: 'TabsLayout',
          spec: {
            tabs: [
              {
                kind: 'TabsLayoutTab',
                spec: { title: 'Services', layout: v2DashboardWithTabsForSlug.spec.layout },
              },
              {
                kind: 'TabsLayoutTab',
                spec: { title: 'Summary', layout: { kind: 'GridLayout', spec: { items: [] } } },
              },
            ],
          },
        },
      },
    };

    await flows.dashboards.importTestDashboard(
      page,
      e2eSelectors,
      'Bookmark dashboard tabs',
      JSON.stringify(dashboard)
    );

    await test.step('Write top-level tab selections to the URL and restore them through browser history', async () => {
      await tabs.select('Summary');
      await expect(page).toHaveURL((url) => url.searchParams.get('dtab') === 'Summary');
      await expect(tabs.getTitle('Summary')).toHaveAttribute('aria-selected', 'true');

      await tabs.select('Services');
      await expect(page).toHaveURL((url) => url.searchParams.get('dtab') === 'Services');
      await expect(tabs.getTitle('Services')).toHaveAttribute('aria-selected', 'true');

      await page.goBack();
      await expect(page).toHaveURL((url) => url.searchParams.get('dtab') === 'Summary');
      await expect(tabs.getTitle('Summary')).toHaveAttribute('aria-selected', 'true');

      await page.goForward();
      await expect(page).toHaveURL((url) => url.searchParams.get('dtab') === 'Services');
      await expect(tabs.getTitle('Services')).toHaveAttribute('aria-selected', 'true');
    });

    const overview = rows.getContent('Overview');

    const bookmarkedUrl =
      await test.step('Write nested tab selections to their own URL key and restore them through browser history', async () => {
        await tabs.select('Metrics&Traces');
        await expect(page).toHaveURL(
          (url) =>
            url.searchParams.get('dtab') === 'Services' &&
            url.searchParams.get('Services-Overview-dtab') === 'Metrics&Traces'
        );
        await expect(tabs.getTitle('Metrics&Traces', overview)).toHaveAttribute('aria-selected', 'true');
        const selectedUrl = page.url();

        await tabs.select('Logs+');
        await expect(page).toHaveURL((url) => url.searchParams.get('Services-Overview-dtab') === 'Logs+');
        await expect(tabs.getTitle('Logs+', overview)).toHaveAttribute('aria-selected', 'true');

        await page.goBack();
        await expect(page).toHaveURL((url) => url.searchParams.get('Services-Overview-dtab') === 'Metrics&Traces');
        await expect(tabs.getTitle('Metrics&Traces', overview)).toHaveAttribute('aria-selected', 'true');

        await page.goForward();
        await expect(page).toHaveURL((url) => url.searchParams.get('Services-Overview-dtab') === 'Logs+');
        await expect(tabs.getTitle('Logs+', overview)).toHaveAttribute('aria-selected', 'true');
        return selectedUrl;
      });

    await test.step('Open the bookmark in a fresh page with the same top-level and nested tabs selected', async () => {
      const sharedPage = await context.newPage();
      try {
        await sharedPage.goto(bookmarkedUrl);
        // The fixtures belong to the original page, so scope the getters to the new page's document.
        const sharedDashboard = sharedPage.locator('body');
        await expect(tabs.getTitle('Services', sharedDashboard)).toHaveAttribute('aria-selected', 'true');
        await expect(tabs.getTitle('Metrics&Traces', sharedDashboard)).toHaveAttribute('aria-selected', 'true');
      } finally {
        await sharedPage.close();
      }
    });
  }
);
