import { type Page, type Request } from '@playwright/test';

import { type E2ESelectorGroups } from '@grafana/plugin-e2e';

import customGridViewDashboard from '../dashboards/CustomGridViewManyPanels.json';

import { dragAndDropOpenFeature, expect, test } from './fixtures';
import { expectPanelBoxesToBe, flows, getPanelBox } from './helpers';
import { type Panels } from './page-objects';

const GRID_COLUMNS = 24;
const GRID_MARGIN = 8;
const ROW_HEIGHT = 30;

interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Where the panels of CustomGridViewManyPanels.json end up: as saved, except that the last two panels,
// saved far below the others, are pulled up to close the gap
const CELLS: Record<string, Cell> = {
  'Panel 1': { x: 0, y: 0, w: 8, h: 8 },
  'Panel 2': { x: 8, y: 0, w: 8, h: 8 },
  'Panel 3': { x: 16, y: 0, w: 8, h: 8 },
  'Panel 4': { x: 0, y: 8, w: 12, h: 6 },
  'Panel 5': { x: 12, y: 8, w: 12, h: 10 },
  'Panel 6': { x: 0, y: 14, w: 12, h: 4 },
  'Panel 7': { x: 0, y: 18, w: 24, h: 8 },
  ...Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [
      `Panel ${index + 8}`,
      { x: (index % 2) * 12, y: 26 + Math.floor(index / 2) * 8, w: 12, h: 8 },
    ])
  ),
  'Panel 20': { x: 0, y: 74, w: 24, h: 6 },
  'Panel 21': { x: 6, y: 80, w: 6, h: 4 },
};
const TITLES = Object.keys(CELLS);
const TOP_TITLES = TITLES.slice(0, 7);

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  openFeature: dragAndDropOpenFeature(),
  viewport: { width: 1920, height: 1080 },
});

async function importDashboard(page: Page, selectors: E2ESelectorGroups, title: string) {
  await flows.dashboards.importTestDashboard(page, selectors, title, JSON.stringify(customGridViewDashboard), {
    requiresDataSourceSelection: false,
  });
}

/** The uid of the dashboard the page shows, from its /d/<uid>/<slug> URL */
function getDashboardUid(page: Page): string {
  return new URL(page.url()).pathname.split('/')[2];
}

function getLayoutContainer(page: Page, selectors: E2ESelectorGroups) {
  return page.getByTestId(selectors.components.LayoutContainer(''));
}

/**
 * Expects the panels at the boxes their cells give in a grid as wide as the layout container, measured
 * from where Panel 1 (the top-left cell) is. The same geometry for the react-grid-layout grid and the new
 * custom grid, so the projects compare the two.
 */
async function expectPanelsAtCells(page: Page, selectors: E2ESelectorGroups, panels: Panels, titles = TITLES) {
  const container = await getLayoutContainer(page, selectors).boundingBox();
  expect(container, 'The layout container should have a bounding box').not.toBeNull();
  const origin = await getPanelBox(panels, 'Panel 1');
  expect(Math.abs(origin.x - container!.x), 'Panel 1 should start at the left of the grid').toBeLessThanOrEqual(2);

  const columnWidth = (container!.width - (GRID_COLUMNS - 1) * GRID_MARGIN) / GRID_COLUMNS;
  const expected = Object.fromEntries(
    titles.map((title) => {
      const { x, y, w, h } = CELLS[title];
      return [
        title,
        {
          x: origin.x + x * (columnWidth + GRID_MARGIN),
          y: origin.y + y * (ROW_HEIGHT + GRID_MARGIN),
          width: w * columnWidth + (w - 1) * GRID_MARGIN,
          height: h * ROW_HEIGHT + (h - 1) * GRID_MARGIN,
        },
      ];
    })
  );
  await expectPanelBoxesToBe(panels, expected);
}

/** The alias of every testdata query the dashboard ran, which tells the panels that queried apart */
function recordQueriedPanels(page: Page): Set<string> {
  const queried = new Set<string>();
  page.on('request', (request: Request) => {
    if (!request.url().includes('/api/ds/query')) {
      return;
    }
    const body: { queries?: Array<{ alias?: string }> } | null = request.postDataJSON();
    for (const query of body?.queries ?? []) {
      if (query.alias) {
        queried.add(query.alias);
      }
    }
  });
  return queried;
}

const aliasOf = (title: string) => `view-panel-${title.replace('Panel ', '')}`;

// Runs in the default project (react-grid-layout) and, with E2E_NEW_GRID_VIEW=1, with the new custom grid
// rendering view mode too, against the same expectations
test.describe(
  'Dashboard custom grid in view mode',
  {
    tag: ['@dashboards', '@new-grid-view'],
  },
  () => {
    test('renders the panels at their grid positions, without transitions', async ({
      page,
      selectors,
      panels,
      newGridView,
    }) => {
      await importDashboard(page, selectors, 'Custom grid view - positions');

      await expect(page.locator('[data-custom-grid]')).toHaveCount(newGridView ? 1 : 0);
      await expectPanelsAtCells(page, selectors, panels);

      // A transition on first paint would animate the panels into place
      const transitions = await page.locator('[data-griditem-key]').evaluateAll((items) =>
        items
          .map((item) => getComputedStyle(item))
          .filter(
            (style) =>
              style.transitionProperty !== 'none' &&
              style.transitionDuration.split(',').some((duration) => parseFloat(duration) > 0)
          )
          .map((style) => `${style.transitionProperty} ${style.transitionDuration}`)
      );
      expect(transitions).toEqual([]);
    });

    test('keeps the panels mounted when editing starts', async ({ page, selectors, controls, panels, newGridView }) => {
      await importDashboard(page, selectors, 'Custom grid view - enter edit mode');
      // Marks the panel's element, a remount replaces it with one without the mark
      await panels.getPanel('Panel 2').evaluate((element) => element.setAttribute('data-test-mounted', 'view'));

      await controls.enterEditMode();

      await expect(page.locator('[data-custom-grid]')).toHaveCount(newGridView ? 1 : 0);
      await expect(panels.getPanel('Panel 2')).toHaveAttribute('data-test-mounted', 'view');
    });

    test('lets panels below the fold query only once they are scrolled into view', async ({
      page,
      selectors,
      panels,
    }) => {
      const queried = recordQueriedPanels(page);

      await importDashboard(page, selectors, 'Custom grid view - lazy loading');

      // The panels in view query straight away
      await expect.poll(() => TOP_TITLES.every((title) => queried.has(aliasOf(title)))).toBe(true);
      // Two screens further down, rendered but not queried
      await expect(panels.getPanel('Panel 21')).toBeAttached();
      expect(queried.has(aliasOf('Panel 20'))).toBe(false);
      expect(queried.has(aliasOf('Panel 21'))).toBe(false);

      await panels.getPanel('Panel 21').scrollIntoViewIfNeeded();

      await expect.poll(() => queried.has(aliasOf('Panel 21'))).toBe(true);
    });

    test('renders the panels at their grid positions in kiosk mode', async ({
      page,
      selectors,
      panels,
      newGridView,
    }) => {
      await importDashboard(page, selectors, 'Custom grid view - kiosk');
      const url = new URL(page.url());
      url.searchParams.set('kiosk', '');

      await page.goto(url.toString());

      await expect(panels.getPanel('Panel 1')).toBeVisible();
      await expect(page.locator('[data-custom-grid]')).toHaveCount(newGridView ? 1 : 0);
      await expectPanelsAtCells(page, selectors, panels);
    });

    test('renders the panels at their grid positions in a snapshot', async ({
      page,
      request,
      selectors,
      panels,
      newGridView,
    }) => {
      // Snapshots are taken of saved dashboards
      await importDashboard(page, selectors, 'Custom grid view - snapshot');
      const uid = getDashboardUid(page);
      const response = await request.post('/api/snapshots', {
        data: { dashboard: { ...customGridViewDashboard, uid }, name: 'Custom grid view - snapshot', expires: 3600 },
      });
      expect(response.ok(), 'The snapshot should be created').toBe(true);
      const { key }: { key: string } = await response.json();

      await page.goto(`/dashboard/snapshot/${key}`);

      await expect(panels.getPanel('Panel 1')).toBeVisible();
      await expect(page.locator('[data-custom-grid]')).toHaveCount(newGridView ? 1 : 0);
      await expectPanelsAtCells(page, selectors, panels);
    });

    test('renders the panels at their grid positions in a public dashboard', async ({
      page,
      request,
      selectors,
      panels,
      newGridView,
    }) => {
      await importDashboard(page, selectors, 'Custom grid view - public dashboard');
      const uid = getDashboardUid(page);
      const response = await request.post(`/api/dashboards/uid/${uid}/public-dashboards`, {
        data: { isEnabled: true, share: 'public' },
      });
      expect(response.ok(), 'The public dashboard should be created').toBe(true);
      const { accessToken }: { accessToken: string } = await response.json();

      await page.goto(`/public-dashboards/${accessToken}`);

      await expect(panels.getPanel('Panel 1')).toBeVisible();
      await expect(page.locator('[data-custom-grid]')).toHaveCount(newGridView ? 1 : 0);
      await expectPanelsAtCells(page, selectors, panels);
    });

    test.describe('on a small screen', () => {
      test.use({ viewport: { width: 600, height: 1000 } });

      test('stacks the panels at full width in the order of their positions', async ({
        page,
        selectors,
        panels,
        newGridView,
      }) => {
        await importDashboard(page, selectors, 'Custom grid view - small screen');

        await expect(page.locator('[data-custom-grid]')).toHaveCount(newGridView ? 1 : 0);
        const container = await getLayoutContainer(page, selectors).boundingBox();
        expect(container, 'The layout container should have a bounding box').not.toBeNull();

        let previousBottom: number | undefined;
        for (const title of TITLES) {
          const box = await getPanelBox(panels, title);
          const { h } = CELLS[title];
          expect(Math.abs(box.x - container!.x), `"${title}" x`).toBeLessThanOrEqual(2);
          expect(Math.abs(box.width - container!.width), `"${title}" width`).toBeLessThanOrEqual(2);
          expect(
            Math.abs(box.height - (h * ROW_HEIGHT + (h - 1) * GRID_MARGIN)),
            `"${title}" height`
          ).toBeLessThanOrEqual(2);
          if (previousBottom !== undefined) {
            expect(box.y, `"${title}" should be below the panel before it`).toBeGreaterThan(previousBottom);
          }
          previousBottom = box.y + box.height;
        }
      });
    });
  }
);
