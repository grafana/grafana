import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'nodegraph-item-overrides';

// The provisioned dashboard has two identical node graphs: the first carries item overrides,
// the second does not, so the same node can be compared with and without a rule applied.
const WITH_OVERRIDES =
  'Item overrides: root is red and large, service:1/2 are purple, edges from root are thick and orange';
const WITHOUT_OVERRIDES = 'Same query with no item overrides, for comparison';

test.use({
  featureToggles: {
    'dashboard.itemOverrides': true,
  },
});

test.describe('Node Graph - item overrides', () => {
  test('applies a node rule to the matching node only', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

    const overridden = dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Panel.title(WITH_OVERRIDES))
      .locator('[data-testid="node-circle-root"]');
    const plain = dashboardPage
      .getByGrafanaSelector(selectors.components.Panels.Panel.title(WITHOUT_OVERRIDES))
      .locator('[data-testid="node-circle-root"]');

    await expect(overridden).toBeVisible();
    await expect(plain).toBeVisible();

    // custom.nodeRadius = 60 applies only where the rule matched
    await expect(overridden).toHaveAttribute('r', '60');
    await expect(plain).not.toHaveAttribute('r', '60');
  });

  test('leaves nodes no rule matched alone', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(WITH_OVERRIDES));

    // Only `root` has a radius rule; service:3 is matched by no rule at all
    await expect(panel.locator('[data-testid="node-circle-root"]')).toHaveAttribute('r', '60');
    await expect(panel.locator('[data-testid="node-circle-service:3"]')).not.toHaveAttribute('r', '60');
  });

  test('thickens only the edges an edge rule matched', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(WITH_OVERRIDES));
    const edges = panel.locator('line[stroke-width]');
    await expect(edges.first()).toBeVisible();

    const widths = await edges.evaluateAll((nodes) =>
      nodes.map((n) => Number(n.getAttribute('stroke-width'))).filter((w) => !Number.isNaN(w))
    );

    // custom.thickness = 6 on edges from root, and not on the rest
    expect(widths).toContain(6);
    expect(widths.some((w) => w !== 6)).toBe(true);
  });

  test('adds a node rule in the editor and repaints that node', async ({ page, gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    // Panel 2 starts with no item overrides
    const panelEditPage = await dashboardPage.gotoPanelEditPage('2');

    const addOverride = page.getByRole('button', { name: 'Add item override' });
    await expect(addOverride).toBeVisible();
    await addOverride.click();

    await page.getByRole('option', { name: 'Items with id' }).click();

    // Two kinds are declared, so the kind selector renders and defaults to Nodes
    await expect(page.getByLabel('Nodes')).toBeChecked();

    const circle = panelEditPage
      .getByGrafanaSelector(selectors.components.Panels.Panel.content)
      .locator('[data-testid="node-circle-root"]');
    await expect(circle).toBeVisible();
  });
});
