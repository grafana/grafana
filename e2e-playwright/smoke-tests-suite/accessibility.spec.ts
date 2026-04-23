import { test, expect } from '@grafana/plugin-e2e';

type TestFn = Parameters<typeof test>[2];
type TestOptions = Parameters<TestFn>[0];

interface A11yTestCase {
  url: string;
  /** number of allowed accessibility violations before the test fails. defaults to 0 */
  threshold?: number;
  /** rules to ignore in the running of the test */
  ignoredRules?: string[];
}

test.describe(
  'A11y smokescreen',
  {
    tag: ['@a11y'],
  },
  () => {
    (
      [
        // Misc
        { url: '/?orgId=1' },
        { url: '/dashboards', ignoredRules: ['label'] },
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge' },
        { url: '/alerting/list', ignoredRules: ['button-name', 'aria-required-parent'] },

        // Dashboard settings
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=settings' },
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=annotations' },
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=variables' },
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=links' },
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=versions' },
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=permissions' },
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=dashboard_json' },

        // Connections
        { url: '/connections' },
        { url: '/connections/datasources' },
        { url: '/connections/add-new-connection' },

        // Admin pages
        //  - General
        { url: '/admin/upgrading' },
        { url: '/org' },
        { url: '/admin/settings' },
        { url: '/admin/orgs' },
        { url: '/admin/migrate-to-cloud' },
        { url: '/admin/provisioning' },

        // - Plugins
        { url: '/plugins' },
        { url: '/datasources/correlations' },
        { url: '/admin/extensions', ignoredRules: ['button-name'] },

        // - Users and access
        { url: '/admin/users' },
        { url: '/org/teams' },
        { url: '/org/serviceaccounts' },

        { url: '/admin/authentication' },

        // Profile pages
        { url: '/profile' },
        { url: '/profile/notifications' },
        { url: '/profile/password' },
      ] satisfies A11yTestCase[]
    ).forEach(({ url, ...options }) =>
      test(url, async ({ page, selectors, scanForA11yViolations }) => {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId(selectors.components.Breadcrumbs.breadcrumb('Home')).first()).toBeVisible();
        await page.waitForTimeout(1_000); // wait an additional second to allow any animations to complete and for the page to stabilize before starting the scan
        const results = await scanForA11yViolations();
        expect(results).toHaveNoA11yViolations(options);
      })
    );
  }
);
