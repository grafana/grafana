import { type Page } from '@playwright/test';

import { test, expect, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { Controls, Sidebar, Tabs, type PageObjectArgs } from './page-objects';
import { groupIntoTab, saveDashboard } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUnifiedDrilldownControls: false,
  },
  // Narrow viewport guarantees the tabs overflow horizontally so the scroll
  // buttons and auto-scroll behaviour are actually exercised.
  viewport: { width: 1280, height: 800 },
});

// 11 tabs comfortably overflow at 1280px while keeping setup quick.
const EXTRA_TABS_TO_APPEND = 10;

// Every test here drives the same three page objects plus the raw fixtures that the
// shared `utils` helpers still take, so they travel together as one context object.
interface TabsScrollContext {
  controls: Controls;
  sidebar: Sidebar;
  tabs: Tabs;
  page: Page;
  dashboardPage: DashboardPage;
  selectors: E2ESelectorGroups;
}

function createContext(args: PageObjectArgs): TabsScrollContext {
  return {
    controls: new Controls(args),
    sidebar: new Sidebar(args),
    tabs: new Tabs(args),
    page: args.page,
    dashboardPage: args.dashboardPage,
    selectors: args.selectors,
  };
}

async function buildOverflowTabs({ controls, sidebar, tabs, page, dashboardPage, selectors }: TabsScrollContext) {
  // A brand new dashboard already opens in edit mode, so there may be nothing to click.
  const editButton = controls.getEnterEditModeButton();
  if (await editButton.isVisible()) {
    await controls.enterEditMode();
  }

  await sidebar.addOptions.clickNewPanelButton();
  await groupIntoTab(page, dashboardPage, selectors);

  for (let i = 0; i < EXTRA_TABS_TO_APPEND; i++) {
    await tabs.clickAddTab();
  }

  const lastTabTitle = `New tab ${EXTRA_TABS_TO_APPEND}`;
  await expect(tabs.getTab(lastTabTitle)).toBeVisible();

  return {
    firstTab: tabs.getTab('New tab'),
    lastTabTitle,
    lastTab: tabs.getTab(lastTabTitle),
  };
}

async function openOutline({ sidebar, page, selectors }: TabsScrollContext) {
  const outlineButton = sidebar.toolbar.getButton('Outline');

  if (!(await outlineButton.isVisible())) {
    const sidebarToggle = sidebar.toolbar.getVisibilityToggle();
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

  // Clicking the toggle leaves the pointer parked on it, so its "Content
  // outline" tooltip stays open and overlaps the top of the outline pane,
  // intercepting clicks on outline items. Move the pointer away and wait for
  // the tooltip to leave the document before callers interact with the pane.
  await page.mouse.move(0, 0);
  await expect(page.getByTestId(selectors.components.Tooltip.container)).not.toBeAttached();
}

test.describe(
  'Dashboard Tabs Scroll',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('shows scroll buttons and supports paged scrolling', async ({
      gotoDashboardPage,
      selectors,
      page,
      components,
    }) => {
      const dashboardPage = await gotoDashboardPage({});
      const ctx = createContext({ page, dashboardPage, selectors, components });

      const { firstTab, lastTab } = await buildOverflowTabs(ctx);

      const scrollLeftButton = ctx.tabs.getScrollButton('left');
      const scrollRightButton = ctx.tabs.getScrollButton('right');

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
        await expect(scrollLeftButton).toBeHidden({ timeout: 2_000 });
      }).toPass();

      // At the start of the list the first tab is in view and only the right
      // scroll button remains.
      await expect(firstTab).toBeInViewport();
      await expect(scrollRightButton).toBeVisible();

      // Clicking "Scroll tabs right" once moves the view away from the start.
      await scrollRightButton.click();
      await expect(firstTab).not.toBeInViewport();
    });

    test('auto-scrolls selected tabs into view from outline', async ({
      gotoDashboardPage,
      selectors,
      page,
      components,
    }) => {
      const dashboardPage = await gotoDashboardPage({});
      const ctx = createContext({ page, dashboardPage, selectors, components });

      const { firstTab, lastTab, lastTabTitle } = await buildOverflowTabs(ctx);

      await openOutline(ctx);
      await ctx.sidebar.contentOutline.clickItem('New tab');
      await expect(firstTab).toBeInViewport();

      // Selecting an outline item can move focus to another edit pane; reopen
      // outline defensively before selecting the second tab.
      await openOutline(ctx);
      await ctx.sidebar.contentOutline.clickItem(lastTabTitle);
      await expect(lastTab).toBeInViewport();
    });

    test('auto-scrolls newly appended tab into view', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({});
      const ctx = createContext({ page, dashboardPage, selectors, components });

      const { firstTab } = await buildOverflowTabs(ctx);

      await openOutline(ctx);
      await ctx.sidebar.contentOutline.clickItem('New tab');
      await expect(firstTab).toBeInViewport();

      await ctx.tabs.clickAddTab();
      const newestTab = ctx.tabs.getTab(`New tab ${EXTRA_TABS_TO_APPEND + 1}`);
      await expect(newestTab).toBeInViewport();
      await expect(firstTab).not.toBeInViewport();
    });

    test('keeps overflow controls after save and reload', async ({
      gotoDashboardPage,
      selectors,
      page,
      components,
    }) => {
      const dashboardPage = await gotoDashboardPage({});
      const ctx = createContext({ page, dashboardPage, selectors, components });

      await buildOverflowTabs(ctx);

      await saveDashboard(dashboardPage, page, selectors, 'test dashboard scroll');
      await page.reload();
      await expect(ctx.tabs.getScrollButton('left')).toBeVisible();
    });
  }
);
