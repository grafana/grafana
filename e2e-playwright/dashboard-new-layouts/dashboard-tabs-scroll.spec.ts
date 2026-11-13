import { type Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { flows } from './helpers';
import { type Canvas, type Sidebar, type Tabs } from './page-objects';

test.use({
  // Narrow viewport guarantees the tabs overflow horizontally so the scroll
  // buttons and auto-scroll behaviour are actually exercised.
  viewport: { width: 1280, height: 800 },
});

// 11 tabs comfortably overflow at 1280px while keeping setup quick.
const EXTRA_TABS_TO_APPEND = 10;

async function buildOverflowTabs(sidebar: Sidebar, canvas: Canvas, tabs: Tabs) {
  await sidebar.addOptions.addTab();

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
    test('can read and scroll overflowing tabs before and after reload', async ({
      gotoDashboardPage,
      page,
      controls,
      sidebar,
      tabs,
      canvas,
    }) => {
      await gotoDashboardPage({});
      const { firstTab } = await buildOverflowTabs(sidebar, canvas, tabs);
      const longTitle = 'Operations metrics across production services, regions, clusters, and availability zones';
      await sidebar.tabOptions.setTitle(longTitle);
      await sidebar.closePane();

      const lastTab = tabs.getTitle(longTitle);
      const scrollLeftButton = tabs.getScrollButton('left');
      const scrollRightButton = tabs.getScrollButton('right');

      await expect(lastTab).toHaveAttribute('aria-selected', 'true');
      await expect(scrollLeftButton).toBeVisible();
      await expect(lastTab).toBeInViewport();
      await expect(firstTab).not.toBeInViewport();

      await test.step('Truncate the long title and identify the active tab layout in edit mode', async () => {
        await expect(lastTab).toHaveText(longTitle);
        await expect(lastTab).toHaveCSS('text-overflow', 'ellipsis');
        await expect(lastTab).toHaveCSS('overflow-x', 'hidden');
        await expect.poll(() => lastTab.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

        const layoutIcon = lastTab.getByTestId('icon-apps');
        await expect(layoutIcon).toBeVisible();
        await layoutIcon.hover();
        await expect(page.getByRole('tooltip')).toHaveText('Auto layout – panel sizes are managed automatically');
        await page.keyboard.press('Escape');
      });

      for (const phase of ['before reload', 'after reload']) {
        if (phase === 'after reload') {
          await flows.dashboards.saveDashboard(page, controls, { title: test.info().title });
          await expect(lastTab).toHaveAttribute('aria-selected', 'true');
          await expect(lastTab).toBeInViewport();
          await expect(firstTab).not.toBeInViewport();
          await expect(lastTab).toHaveCSS('text-overflow', 'ellipsis');
          await expect.poll(() => lastTab.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
          await expect(lastTab.getByTestId('icon-apps')).toBeHidden();
        }

        await test.step(`Reach both ends using the scroll buttons ${phase}`, async () => {
          // Each click scrolls part of the bar; the button disappears at its end.
          await expect(async () => {
            if (await scrollLeftButton.isVisible()) {
              await scrollLeftButton.click();
            }
            await expect(scrollLeftButton).toBeHidden({ timeout: 500 });
          }).toPass();

          await expect(firstTab).toBeInViewport();
          await expect(lastTab).not.toBeInViewport();
          await expect(scrollRightButton).toBeVisible();

          await expect(async () => {
            if (await scrollRightButton.isVisible()) {
              await scrollRightButton.click();
            }
            await expect(scrollRightButton).toBeHidden({ timeout: 500 });
          }).toPass();

          await expect(lastTab).toBeInViewport();
          await expect(firstTab).not.toBeInViewport();
          await expect(scrollLeftButton).toBeVisible();
        });
      }
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
  }
);
