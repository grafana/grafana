import { test, expect, DEFAULT_A11Y_TAGS } from '@grafana/plugin-e2e';

// accessibility.spec.ts scans the same panel edit pages with the default editor; openFeature can only be set per file.
test.use({
  openFeature: { flags: { queryEditorNext: true } },
});

test.describe(
  'A11y smokescreen: panel edit with queryEditorNext',
  {
    tag: ['@a11y'],
  },
  () => {
    [
      '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=2', // time series
      '/d/n1jR8vnnz/panel-tests-all-panels?editPanel=22', // table
    ].forEach((url) =>
      test(url, async ({ page, selectors, scanForA11yViolations }) => {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId(selectors.components.Breadcrumbs.breadcrumb('Home')).first()).toBeVisible();
        await expect(page.locator('[data-query-sidebar-card="A"]')).toBeVisible();
        // disable all transitions - this ensures we don't try to test an element mid-transition (e.g. secondary -> primary button will fail contrast)
        await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
        await page.waitForTimeout(1_000); // wait an additional second to allow the page to stabilize before starting the scan
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
        expect(results).toHaveNoA11yViolations();
      })
    );
  }
);
