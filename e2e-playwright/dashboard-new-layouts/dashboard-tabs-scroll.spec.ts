import { test, expect } from '@grafana/plugin-e2e';

import { groupIntoTab, saveDashboard } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  // Narrow viewport guarantees the tabs overflow horizontally so the scroll
  // buttons and auto-scroll behaviour are actually exercised.
  viewport: { width: 1280, height: 800 },
});

// 11 tabs comfortably overflow at 1280px while keeping setup quick.
const EXTRA_TABS_TO_APPEND = 10;

async function buildOverflowTabs(
  page: Parameters<Parameters<typeof test>[1]>[0]['page'],
  dashboardPage: Parameters<Parameters<typeof test>[1]>[0]['dashboardPage'],
  selectors: Parameters<Parameters<typeof test>[1]>[0]['selectors']
) {
  const editButton = dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton);
  if (await editButton.isVisible()) {
    await editButton.click();
  }

  await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.newPanelButton).click();
  await groupIntoTab(page, dashboardPage, selectors);

  const addTabButton = dashboardPage.getByGrafanaSelector(selectors.components.CanvasGridAddActions.addTab);
  for (let i = 0; i < EXTRA_TABS_TO_APPEND; i++) {
    await addTabButton.click();
  }

  const lastTabTitle = `New tab ${EXTRA_TABS_TO_APPEND}`;
  await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(lastTabTitle))).toBeVisible();

  return {
    addTabButton,
    firstTab: dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('New tab')),
    lastTabTitle,
    lastTab: dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(lastTabTitle)),
  };
}

async function openOutline(
  page: Parameters<Parameters<typeof test>[1]>[0]['page'],
  dashboardPage: Parameters<Parameters<typeof test>[1]>[0]['dashboardPage'],
  selectors: Parameters<Parameters<typeof test>[1]>[0]['selectors']
) {
  const outlineButton = dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Sidebar.outlineButton);
  if (!(await outlineButton.isVisible())) {
    const sidebarToggle = page.getByTestId(selectors.components.Sidebar.showHideToggle);
    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click();
    }
  }

  await expect(outlineButton).toBeVisible();
  await expect(async () => {
    const expanded = await outlineButton.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await outlineButton.click();
    }
    await expect(outlineButton).toHaveAttribute('aria-expanded', 'true');
  }).toPass();
}

test.describe(
  'Dashboard Tabs Scroll',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('shows scroll buttons and supports paged scrolling', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({});
      const { firstTab, lastTab } = await buildOverflowTabs(page, dashboardPage, selectors);

      const scrollLeftButton = page.getByRole('button', { name: 'Scroll tabs left' });
      const scrollRightButton = page.getByRole('button', { name: 'Scroll tabs right' });

      // After appending many tabs the auto-scroll puts us at the end of the list:
      // the left scroll button is visible, the last tab is in view, the first isn't.
      await expect(scrollLeftButton).toBeVisible();
      await expect(lastTab).toBeInViewport();
      await expect(firstTab).not.toBeInViewport();

      // "Scroll tabs left" scrolls one "page" (~80% of the tab bar width) per
      // click, so reaching the first tab generally needs several clicks. Keep
      // clicking while the button remains visible: it hides itself once we've
      // scrolled all the way to the start.
      await expect(async () => {
        if (await scrollLeftButton.isVisible()) {
          await scrollLeftButton.click();
        }
        await expect(scrollLeftButton).toBeHidden();
      }).toPass();

      // At the start of the list the first tab is in view and only the right
      // scroll button remains.
      await expect(firstTab).toBeInViewport();
      await expect(scrollRightButton).toBeVisible();

      // Clicking "Scroll tabs right" once moves the view away from the start.
      await scrollRightButton.click();
      await expect(firstTab).not.toBeInViewport();
    });

    test('auto-scrolls selected tabs into view from outline', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({});
      const { firstTab, lastTab, lastTabTitle } = await buildOverflowTabs(page, dashboardPage, selectors);

      await openOutline(page, dashboardPage, selectors);
      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.Outline.item('New tab')).click();
      await expect(firstTab).toBeInViewport();

      // Selecting an outline item can move focus to another edit pane; reopen
      // outline defensively before selecting the second tab.
      await openOutline(page, dashboardPage, selectors);
      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.Outline.item(lastTabTitle)).click();
      await expect(lastTab).toBeInViewport();
    });

    test('auto-scrolls newly appended tab into view', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({});
      const { addTabButton, firstTab } = await buildOverflowTabs(page, dashboardPage, selectors);

      await openOutline(page, dashboardPage, selectors);
      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.Outline.item('New tab')).click();
      await expect(firstTab).toBeInViewport();

      await addTabButton.click();
      const newestTab = dashboardPage.getByGrafanaSelector(
        selectors.components.Tab.title(`New tab ${EXTRA_TABS_TO_APPEND + 1}`)
      );
      await expect(newestTab).toBeInViewport();
      await expect(firstTab).not.toBeInViewport();
    });

    test('keeps overflow controls after save and reload', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({});
      await buildOverflowTabs(page, dashboardPage, selectors);

      await saveDashboard(dashboardPage, page, selectors, 'test dashboard scroll');
      await page.reload();
      await expect(page.getByRole('button', { name: 'Scroll tabs left' })).toBeVisible();
    });
  }
);
