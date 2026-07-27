import { test, expect, DEFAULT_A11Y_TAGS } from '@grafana/plugin-e2e';

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
        { url: '/' },
        { url: '/dashboards', ignoredRules: ['label'] },
        { url: '/explore' },
        { url: '/alerting/list', ignoredRules: ['button-name', 'aria-required-parent'] },

        // Dashboard
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge' },
        { url: '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=2' }, // time series
        { url: '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=16' }, // stat
        { url: '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=18' }, // gauge
        { url: '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=20' }, // bar gauge
        { url: '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=24' }, // pie chart
        { url: '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=22' }, // table
        { url: '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=14' }, // bar chart
        { url: '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=26' }, // heatmap
        { url: '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=34' }, // text
        { url: '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=12' }, // news
        { url: '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=8' }, // dashboard list
        { url: '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=6' }, // alert list
        { url: '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=10' }, // annotation list
        { url: '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=28' }, // logs
        { url: '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=4' }, // histogram
        // TODO fix a11y issues
        // { url: '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=41' }, // state timeline
        // { url: '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=62' }, // geomap

        // Dashboard settings
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?editview=settings' },
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?editview=versions' },
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?editview=permissions' },
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?editview=dashboard_json' },

        // - Annotations
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?editview=annotations' },
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?editview=annotations&editIndex=0' },

        // - Variables
        { url: '/d/O6f11TZWk/panel-tests-bar-gauge?editview=variables' },
        { url: '/d/-Y-tnEDWk/templating-nested-template-variables?editview=variables&editIndex=0' }, // query
        { url: '/d/e7c29343-6d1e-4167-9c13-803fe5be8c46/templating-macros?editview=variables&editIndex=0' }, // custom
        { url: '/d/spVR9LSMk/templating-textbox-and-data-links?editview=variables&editIndex=0' }, // textbox
        // TODO find dashboards with examples of these variable types
        // { url: '' }, // constant
        // { url: '' }, // datasource
        { url: '/d/000000002/datasource-tests-influxdb-templated?editview=variables&editIndex=2' }, // interval
        // TODO find dashboards with examples of these variable types
        // { url: '' }, // filter
        // { url: '' }, // switch

        // - Links
        { url: '/d/yBCC3aKGk/templating-dashboard-links-and-variables?editview=links' },
        { url: '/d/yBCC3aKGk/templating-dashboard-links-and-variables?editview=links&editIndex=0' }, // Link
        { url: '/d/yBCC3aKGk/templating-dashboard-links-and-variables?editview=links&editIndex=1' }, // Dashboard link

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
        const results = await scanForA11yViolations({
          options: {
            rules: {
              'heading-order': { enabled: true },
            },
            runOnly: {
              type: 'tag',
              values: DEFAULT_A11Y_TAGS,
            },
          },
        });
        expect(results).toHaveNoA11yViolations(options);
      })
    );
  }
);
