import { selectors } from '@grafana/e2e-selectors';
import { test, expect } from '@grafana/plugin-e2e';

import testV2Dashboard from '../dashboards/V2DashboardWithTabsForSlugTest.json';

import { Rows, Tabs } from './page-objects';
import { importTestDashboard } from './utils';

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
        await importTestDashboard(page, selectors, 'url-sync-tabs-test', JSON.stringify(testV2Dashboard));
        const match = page.url().match(/\/d\/([^/?]+)/);
        dashboardUid = match![1];
      } finally {
        await page.close();
      }
    });

    for (const testCase of testCases) {
      test(testCase.description, async ({ dashboardPage, selectors, page, components }) => {
        const tabs = new Tabs({ page, dashboardPage, selectors, components });
        const rows = new Rows({ page, dashboardPage, selectors, components });

        await page.goto(buildDashboardPathWithSearch(dashboardUid, testCase.searchParams));

        const tabLocator = testCase.rowTitle
          ? tabs.getTab(testCase.expectedSelectedTab, rows.getWrapper(testCase.rowTitle))
          : tabs.getTab(testCase.expectedSelectedTab);

        await expect(tabLocator).toHaveAttribute('aria-selected', 'true');
      });
    }
  }
);
