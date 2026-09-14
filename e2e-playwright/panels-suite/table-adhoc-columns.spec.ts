import { type Locator } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

import { waitForTableLoad } from './table-utils';

const DASHBOARD_UID = 'table-adhoc-columns';

test.use({
  // Both are OpenFeature flags, so they go through the `openFeature` fixture rather than the legacy
  // `featureToggles` one, and per file rather than in the e2e server config so nothing else moves.
  openFeature: { flags: { 'table.refresh': true, 'table.refreshNewFeatures': true } },
  viewport: { width: 1600, height: 1200 },
});

/** Header labels of the table in `panel`, left to right. */
const headerNames = (panel: Locator) => panel.locator('[role="columnheader"] button[title]').allTextContents();

/**
 * Ad-hoc column order and visibility. What earns an e2e here is not that a column disappears — unit
 * tests cover that — but the things only a real pipeline shows: that a hidden column can be brought
 * back *with its data*, that the view survives a refresh, and that none of it persists.
 *
 * Every locator is scoped to the panel under test. The dashboard's panels share field names, and the
 * view-panel layout puts its own sidebar over the rightmost column, so page-wide locators are both
 * ambiguous and occasionally unclickable.
 */
test.describe('Panels test: Table - ad-hoc columns', { tag: ['@panels', '@table'] }, () => {
  test('hides a column from the header menu and brings it back from the sidebar, with its values', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Ad-hoc columns'));

    await waitForTableLoad(panel);
    expect(await headerNames(panel)).toEqual(['region', 'host', 'cpu', 'mem']);

    const menu = selectors.components.Panels.Visualization.TableNG.headerColumnMenu;
    const sidebar = selectors.components.Panels.Visualization.TableNG.columnsSidebar;

    await panel.getByLabel('Column options for host').click();
    await page.getByTestId(menu.hideItem).click();

    await expect.poll(() => headerNames(panel)).toEqual(['region', 'cpu', 'mem']);

    // The field is gone from the frame at this point, so the only thing that still knows about the
    // column is the pre-stage data the sidebar reads.
    await panel.getByLabel('Column options for region').click();
    await page.getByTestId(menu.manageColumnsItem).click();

    await expect(panel.getByTestId(sidebar.container)).toBeVisible();
    await expect(panel.getByTestId(sidebar.row('host'))).toBeVisible();

    // The shared Checkbox keeps its input visually hidden behind a styled span, which is what a
    // click would otherwise land on.
    await panel.getByTestId(sidebar.visibilityToggle('host')).click({ force: true });

    await expect.poll(() => headerNames(panel)).toEqual(['region', 'host', 'cpu', 'mem']);

    // The point of the round trip: the values have to survive it. Scenes truncates the values array
    // of a field that leaves the render, and the stage does not refetch to rebuild it.
    await expect(panel.getByRole('gridcell').filter({ hasText: 'web-1' })).toBeVisible();
    await expect(panel.getByRole('gridcell').filter({ hasText: 'web-4' })).toBeVisible();
  });

  test('offers filtering on every column without any field config for it', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    // Filtering is no longer a per-field opt-in for the table panel, and the field option is gone,
    // so a table with nothing configured still filters.
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Ad-hoc columns'));

    await waitForTableLoad(panel);

    const menu = selectors.components.Panels.Visualization.TableNG.headerColumnMenu;

    for (const column of ['region', 'host', 'cpu', 'mem']) {
      await panel.getByLabel(`Column options for ${column}`).click();
      await expect(page.getByTestId(menu.filterItem)).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

  test('does not offer pinning', async ({ gotoDashboardPage, selectors, page }) => {
    // Pinning is half a reorder and half a panel option, so it is not part of this stage.
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Ad-hoc columns'));

    await waitForTableLoad(panel);
    await panel.getByLabel('Column options for host').click();

    const menu = selectors.components.Panels.Visualization.TableNG.headerColumnMenu;
    await expect(page.getByTestId(menu.hideItem)).toBeVisible();
    await expect(page.getByTestId(menu.pinItem)).toBeHidden();
  });

  test('keeps the view across a refresh', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Ad-hoc columns'));

    await waitForTableLoad(panel);
    await panel.getByLabel('Column options for cpu').click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.hideItem).click();

    await expect.poll(() => headerNames(panel)).toEqual(['region', 'host', 'mem']);

    // A hide changes the field count, which is itself a structure change — the table used to drop
    // its column state on exactly this signal, which would have undone the click.
    await dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2).click();
    await waitForTableLoad(panel);
    await expect.poll(() => headerNames(panel)).toEqual(['region', 'host', 'mem']);
  });

  test('does not persist the view, by design for now', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Ad-hoc columns'));

    await waitForTableLoad(panel);
    await panel.getByLabel('Column options for host').click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.hideItem).click();

    await expect.poll(() => headerNames(panel)).toEqual(['region', 'cpu', 'mem']);

    // Nothing reaches the saved dashboard and nothing is in the URL yet, so a reload starts over.
    // This assertion is the one that has to change when URL persistence lands.
    await page.reload();
    await waitForTableLoad(panel);

    await expect.poll(() => headerNames(panel)).toEqual(['region', 'host', 'cpu', 'mem']);
  });

  test('keeps an ad-hoc change scoped to the frame on screen', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Panel.title('Ad-hoc columns, two frames')
    );

    await waitForTableLoad(panel);
    expect(await headerNames(panel)).toEqual(['region', 'host', 'cpu', 'mem']);

    await panel.getByLabel('Column options for cpu').click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.hideItem).click();

    await expect.poll(() => headerNames(panel)).toEqual(['region', 'host', 'mem']);

    // The two frames share field names, so an unscoped organize would take "cpu" out of both and the
    // frame picker would present a column that had gone missing.
    await panel.getByRole('combobox').first().click();
    await page.getByRole('option').nth(1).click();

    await waitForTableLoad(panel);
    await expect.poll(() => headerNames(panel)).toEqual(['region', 'host', 'cpu', 'mem']);
  });

  test('stacks after the transformations the panel author configured', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Panel.title('Ad-hoc columns over a panel transformation')
    );

    await waitForTableLoad(panel);
    // The panel's own organize puts mem first
    expect(await headerNames(panel)).toEqual(['mem', 'region', 'host', 'cpu']);

    await panel.getByLabel('Column options for host').click();
    await page.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.hideItem).click();

    // Both applied: the author's order kept, the ad-hoc hide on top of it
    await expect.poll(() => headerNames(panel)).toEqual(['mem', 'region', 'cpu']);
  });

  test('opens the sidebar with the panel when the option is set', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Panel.title('Ad-hoc columns with the sidebar open')
    );

    const sidebar = selectors.components.Panels.Visualization.TableNG.columnsSidebar;

    await waitForTableLoad(panel);
    await expect(panel.getByTestId(sidebar.container)).toBeVisible();

    await panel.getByTestId(sidebar.closeButton).click();
    await expect(panel.getByTestId(sidebar.container)).toBeHidden();
  });

  test('a11y', { tag: ['@a11y'] }, async ({ gotoDashboardPage, scanForA11yViolations, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Panel.title('Ad-hoc columns with the sidebar open')
    );

    await waitForTableLoad(panel);
    await expect(
      panel.getByTestId(selectors.components.Panels.Visualization.TableNG.columnsSidebar.container)
    ).toBeVisible();

    // Scoped to the panel: the dashboard page itself carries pre-existing violations (no level-one
    // heading, content outside landmarks) that have nothing to do with this table.
    const report = await scanForA11yViolations({
      include: panel,
      options: {
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
    });

    expect(report.violations).toHaveLength(0);
  });
});
