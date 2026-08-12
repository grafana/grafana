import { type Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { flows } from './helpers';
import { type Canvas, type Sidebar, type Tabs } from './page-objects';

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

async function buildOverflowTabs(sidebar: Sidebar, canvas: Canvas, tabs: Tabs) {
  await sidebar.addOptions.clickAddTabButton();

  for (let i = 0; i < EXTRA_TABS_TO_APPEND; i++) {
    await canvas.addTab();
  }

  const lastTabTitle = `New tab ${EXTRA_TABS_TO_APPEND}`;
  const lastTab = tabs.getTitle(lastTabTitle);
  await expect(lastTab).toBeVisible();

  return {
    firstTab: tabs.getTitle('New tab'),
    lastTabTitle,
    lastTab,
  };
}

async function openContentOutline(page: Page, sidebar: Sidebar) {
  await test.step('Open content outline', async () => {
    await sidebar.toolbar.clickButton('Outline');
    await page.keyboard.press('Escape'); // dismiss the "Content ooutline" tooltip so it does not block outline node clicks
  });
}

test.describe(
  'Dashboard Tabs Scroll',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('shows scroll buttons and supports paged scrolling', async ({
      gotoDashboardPage,
      page,
      sidebar,
      tabs,
      canvas,
    }) => {
      await gotoDashboardPage({});
      const { firstTab, lastTab } = await buildOverflowTabs(sidebar, canvas, tabs);

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
      page,
      sidebar,
      tabs,
      canvas,
    }) => {
      await gotoDashboardPage({});
      const { firstTab, lastTab, lastTabTitle } = await buildOverflowTabs(sidebar, canvas, tabs);

      await openContentOutline(page, sidebar);
      await sidebar.contentOutline.clickItem('New tab');
      await expect(firstTab).toBeInViewport();

      await openContentOutline(page, sidebar);
      await sidebar.contentOutline.clickItem(lastTabTitle);
      await expect(lastTab).toBeInViewport();
    });

    test('auto-scrolls newly appended tab into view', async ({ gotoDashboardPage, page, sidebar, tabs, canvas }) => {
      await gotoDashboardPage({});
      const { firstTab } = await buildOverflowTabs(sidebar, canvas, tabs);

      await openContentOutline(page, sidebar);
      await sidebar.contentOutline.clickItem('New tab');
      await expect(firstTab).toBeInViewport();

      await canvas.addTab();
      const newestTab = tabs.getTitle(`New tab ${EXTRA_TABS_TO_APPEND + 1}`);
      await expect(newestTab).toBeInViewport();
      await expect(firstTab).not.toBeInViewport();
    });

    test('keeps overflow controls after save and reload', async ({
      gotoDashboardPage,
      page,
      controls,
      sidebar,
      tabs,
      canvas,
    }) => {
      await gotoDashboardPage({});
      await buildOverflowTabs(sidebar, canvas, tabs);

      await flows.dashboards.saveDashboard(page, controls, { title: test.info().title });

      await expect(page.getByRole('button', { name: 'Scroll tabs left' })).toBeVisible();
    });
  }
);
