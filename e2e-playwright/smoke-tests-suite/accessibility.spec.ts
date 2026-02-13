import { test, expect } from '@grafana/plugin-e2e';

import { runA11yAudit } from '../utils/axe-a11y';

type TestFn = Parameters<typeof test>[2];
type TestOptions = Parameters<TestFn>[0];

interface A11yTestCase {
  url: string;
  /**
   * number of allowed accessibility violations before the test fails. defaults to 0
   */
  threshold?: number;
  /**
   * async method which will resolve when the test can begin. This can be used to wait for specific
   * elements to be visible or for certain interactions to be completed before starting the accessibility scan.
   * defaults to check for the visibility of the Home breadcrumb element
   * @param opts
   */
  ready?: (opts: Pick<TestOptions, 'page' | 'selectors'>) => Promise<void>;
}

const DEFAULT_READY: A11yTestCase['ready'] = async ({ page, selectors }) => {
  await expect(page.getByTestId(selectors.components.Breadcrumbs.breadcrumb('Home')).first()).toBeVisible();
  await page.waitForTimeout(1_000); // wait an additional second to allow any animations to complete and for the page to stabilize before starting the scan
};

test.describe(
  'A11y smokescreen',
  {
    tag: ['@acceptance', '@a11y'],
  },
  () => {
    (
      [
        {
          url: '/?orgId=1',
          ready: async (opts) => await expect(opts.page.getByText('Welcome to Grafana')).toBeVisible(),
        },
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge' },

        // Dashboard settings
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=settings' },
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=annotations' },
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=variables' },
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=links' },
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=versions' },
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=permissions', threshold: 5 }, // TODO: improve the accessibility of the permission tab https://github.com/grafana/grafana/issues/77203
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=dashboard_json', threshold: 2 },

        // Misc
        {
          url: '/?orgId=1&search=open',
          ready: async ({ page }) => await expect(page.getByText('Welcome to Grafana')).toBeVisible(),
        }, // the search page has a lot of accessibility violations, but it's not a page that users will commonly interact with, so we'll just check for the presence of the welcome message to ensure the page is loaded before running the scan
        { url: '/alerting/list', threshold: 7 }, // the unified alerting promotion alert's content contrast is too low, see https://github.com/grafana/grafana/pull/41829
        { url: '/datasources' },
        { url: '/org/users', threshold: 2 },
        { url: '/org/teams', threshold: 1 },
        { url: '/plugins' },
        { url: '/org', threshold: 2 },
        { url: '/org/apikeys', threshold: 4 },
        { url: '/dashboards', threshold: 2 },
      ] satisfies A11yTestCase[]
    ).forEach(({ url, threshold = 0, ready = DEFAULT_READY }) =>
      test(url, async ({ page, selectors }) => {
        await page.goto(url);
        await ready({ page, selectors });
        await runA11yAudit(page, { threshold, disabledRules: ['region'] });
      })
    );
  }
);
