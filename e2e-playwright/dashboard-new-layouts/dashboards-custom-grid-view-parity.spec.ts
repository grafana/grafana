import { type Page } from '@playwright/test';

import { type E2ESelectorGroups } from '@grafana/plugin-e2e';

import customGridViewDashboard from '../dashboards/CustomGridViewManyPanels.json';
import v2DashboardCustomGrid from '../dashboards/V2DashCustomGridDnd.json';
import v2DashboardRowsWithCustomGrids from '../dashboards/V2DashRowsWithCustomGridsDnd.json';
import v2DashboardWithRepeats from '../dashboards/V2DashWithRepeats.json';
import v2DashboardWithTabRepeats from '../dashboards/V2DashWithTabRepeats.json';

import { dragAndDropOpenFeature, expect, test } from './fixtures';
import { flows } from './helpers';

const GRID_MARGIN = 8;
// Both grid flags, as the localStorage provider reads them: it is asked before the flag service
const GRID_FLAG_OVERRIDES = [
  'grafana.openfeature.grafana.dashboardUnifiedDragAndDrop',
  'grafana.openfeature.grafana.dashboardNewGridView',
];
// Share of the screenshot's pixels allowed to differ, for anti-aliasing of text and borders
const MAX_DIFF_PIXEL_RATIO = 0.002;
// Largest difference in any color channel of a pixel that still counts as the same color
const PIXEL_CHANNEL_THRESHOLD = 32;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Rendering {
  /** Every rendered panel by title; panels with the same title in the order of their positions */
  panels: Record<string, Box[]>;
  /** Every layout container by test id, which tells the height the grids take up */
  layouts: Record<string, Box[]>;
  hasCustomGrid: boolean;
  screenshot: Buffer;
}

interface Sample {
  name: string;
  dashboard: unknown;
  /** Panels with data that changes on every load, so only their chrome is compared */
  maskPanelContent: boolean;
  /** The dashboard has a data source input to fill in on import */
  requiresDataSourceSelection?: boolean;
}

const SAMPLES: Sample[] = [
  { name: 'Mixed sizes', dashboard: customGridViewDashboard, maskPanelContent: true },
  { name: 'Text panels', dashboard: v2DashboardCustomGrid, maskPanelContent: false },
  { name: 'Repeats', dashboard: v2DashboardWithRepeats, maskPanelContent: true, requiresDataSourceSelection: true },
  { name: 'Rows with custom grids', dashboard: v2DashboardRowsWithCustomGrids, maskPanelContent: false },
  {
    name: 'Tabs with repeated rows and panels',
    dashboard: v2DashboardWithTabRepeats,
    maskPanelContent: true,
    requiresDataSourceSelection: true,
  },
];

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  openFeature: dragAndDropOpenFeature(),
  viewport: { width: 1920, height: 1080 },
});

/** Imports the dashboard and waits until the page shows it */
async function importDashboard(
  page: Page,
  selectors: E2ESelectorGroups,
  title: string,
  dashboard: unknown,
  requiresDataSourceSelection = false
) {
  await flows.dashboards.importTestDashboard(page, selectors, title, JSON.stringify(dashboard), {
    checkPanelsVisible: false,
    requiresDataSourceSelection,
  });
  await expect(page).toHaveURL(/\/d\//);
}

/** Reloads the dashboard with both grid flags off, whatever the project sets, or with the project's flags */
async function reload(page: Page, flags: 'off' | 'project') {
  await page.evaluate(
    ([keys, off]) => {
      for (const key of keys) {
        if (off) {
          localStorage.setItem(key, 'false');
        } else {
          localStorage.removeItem(key);
        }
      }
    },
    [GRID_FLAG_OVERRIDES, flags === 'off'] as const
  );
  await page.reload();
}

/** Boxes of every panel and layout container, by test id */
async function readBoxes(page: Page, selectors: E2ESelectorGroups) {
  const read = (testIdPrefix: string) =>
    page.getByTestId(new RegExp(`^${testIdPrefix}`)).evaluateAll((elements) => {
      const boxes: Record<string, Box[]> = {};
      for (const element of elements) {
        const { x, y, width, height } = element.getBoundingClientRect();
        const testId = element.getAttribute('data-testid')!;
        (boxes[testId] ??= []).push({ x, y, width, height });
      }
      for (const list of Object.values(boxes)) {
        list.sort((a, b) => a.y - b.y || a.x - b.x);
      }
      return boxes;
    });

  return {
    panels: await read(selectors.components.Panels.Panel.title('')),
    layouts: await read(selectors.components.LayoutContainer('')),
  };
}

/**
 * Waits until the panels in view have loaded and nothing moves any more, e.g. repeats that fill in once
 * their variables load, then reads what the dashboard renders
 */
async function readRendering(page: Page, selectors: E2ESelectorGroups, sample: Sample): Promise<Rendering> {
  return test.step('Read the rendered dashboard', async () => {
    await expect(page.getByTestId(new RegExp(`^${selectors.components.Panels.Panel.title('')}`)).first()).toBeVisible();
    await expect(page.getByLabel(selectors.components.Panels.Panel.loadingBar(''), { exact: true })).toHaveCount(0);

    let previous = '';
    await expect
      .poll(
        async () => {
          const current = JSON.stringify(await readBoxes(page, selectors));
          const isStable = current === previous;
          previous = current;
          return isStable;
        },
        { message: 'The panels should stop moving', intervals: [250] }
      )
      .toBe(true);

    // Away from the panels, so none shows its hover state
    await page.mouse.move(0, 0);
    const screenshot = await page.screenshot({
      animations: 'disabled',
      caret: 'hide',
      mask: sample.maskPanelContent ? [page.getByTestId(selectors.components.Panels.Panel.content)] : [],
    });

    return {
      ...(await readBoxes(page, selectors)),
      hasCustomGrid: (await page.locator('[data-custom-grid]').count()) > 0,
      screenshot,
    };
  });
}

function expectSameBoxes(actual: Record<string, Box[]>, expected: Record<string, Box[]>, what: string) {
  expect(Object.keys(actual).sort(), `The same ${what}`).toEqual(Object.keys(expected).sort());
  for (const [testId, boxes] of Object.entries(expected)) {
    expect(actual[testId], `As many "${testId}"`).toHaveLength(boxes.length);
    boxes.forEach((box, index) => {
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        expect(Math.abs(actual[testId][index][key] - box[key]), `"${testId}" #${index + 1} ${key}`).toBeLessThanOrEqual(
          1
        );
      }
    });
  }
}

/**
 * Compares two screenshots pixel by pixel in a blank page, which has no content security policy that keeps
 * the canvas from reading them
 */
async function countDifferentPixels(page: Page, expected: Buffer, actual: Buffer) {
  const blank = await page.context().newPage();
  try {
    return await blank.evaluate(
      async ([expectedPng, actualPng, threshold]) => {
        const load = async (png: string) => {
          const image = new Image();
          image.src = `data:image/png;base64,${png}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d')!;
          context.drawImage(image, 0, 0);
          return context.getImageData(0, 0, image.width, image.height);
        };
        const [a, b] = await Promise.all([load(expectedPng), load(actualPng)]);
        if (a.width !== b.width || a.height !== b.height) {
          return { size: [b.width, b.height], expectedSize: [a.width, a.height], different: a.width * a.height };
        }

        let different = 0;
        for (let index = 0; index < a.data.length; index += 4) {
          for (let channel = 0; channel < 3; channel++) {
            if (Math.abs(a.data[index + channel] - b.data[index + channel]) > threshold) {
              different++;
              break;
            }
          }
        }
        return { size: [b.width, b.height], expectedSize: [a.width, a.height], different };
      },
      [expected.toString('base64'), actual.toString('base64'), PIXEL_CHANNEL_THRESHOLD] as const
    );
  } finally {
    await blank.close();
  }
}

async function expectSameRendering(page: Page, actual: Rendering, expected: Rendering) {
  expectSameBoxes(actual.layouts, expected.layouts, 'layout containers');
  expectSameBoxes(actual.panels, expected.panels, 'panels');

  await test.info().attach('flags off.png', { body: expected.screenshot, contentType: 'image/png' });
  await test.info().attach('project flags.png', { body: actual.screenshot, contentType: 'image/png' });
  const { size, expectedSize, different } = await countDifferentPixels(page, expected.screenshot, actual.screenshot);
  expect(size, 'The screenshots should have the same size').toEqual(expectedSize);
  expect(different / (size[0] * size[1]), 'Share of pixels that differ').toBeLessThanOrEqual(MAX_DIFF_PIXEL_RATIO);
}

interface GridItemFrame {
  /** Share of the grid width plus a margin, the same at every grid width */
  x: number;
  y: number;
  /** Share of the grid width plus a margin, the same at every grid width */
  width: number;
  height: number;
  /** The grid width plus a margin, to tell the shares back in pixels */
  span: number;
}

/**
 * Records, on every frame, where each grid item is relative to its grid. A frame in which an item is not
 * yet sized or placed, or is still moving into place, shows as a different position than the one it
 * settles at, even if the grid changed width in between.
 */
function recordGridItemFrames(page: Page) {
  return page.addInitScript((margin: number) => {
    const frames: Record<string, GridItemFrame[]> = {};
    Object.assign(window, { __gridItemFrames: frames });

    const record = () => {
      for (const item of document.querySelectorAll<HTMLElement>('[data-griditem-key]')) {
        const grid = item.parentElement!.getBoundingClientRect();
        const rect = item.getBoundingClientRect();
        const span = grid.width + margin;
        const frame = {
          x: (rect.left - grid.left) / span,
          y: rect.top - grid.top,
          width: (rect.width + margin) / span,
          height: rect.height,
          span,
        };
        const list = (frames[item.dataset.griditemKey!] ??= []);
        const last = list[list.length - 1];
        if (!last || (['x', 'y', 'width', 'height', 'span'] as const).some((key) => last[key] !== frame[key])) {
          list.push(frame);
        }
      }
      requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
  }, GRID_MARGIN);
}

/** How many grid items were recorded, and those that were at another position in any frame than the one they settled at */
function getMovedGridItems(page: Page) {
  return page.evaluate(() => {
    const { __gridItemFrames: frames } = window as unknown as { __gridItemFrames: Record<string, GridItemFrame[]> };

    const moved = Object.entries(frames)
      .filter(([, list]) => {
        const last = list[list.length - 1];
        return list.some(
          (frame) =>
            Math.abs(frame.x - last.x) * last.span > 1 ||
            Math.abs(frame.width - last.width) * last.span > 1 ||
            Math.abs(frame.y - last.y) > 1 ||
            Math.abs(frame.height - last.height) > 1
        );
      })
      .map(([key, list]) => ({ key, frames: list }));
    return { recorded: Object.keys(frames).length, moved };
  });
}

function clearGridItemFrames(page: Page) {
  return page.evaluate(() => {
    const { __gridItemFrames: frames } = window as unknown as { __gridItemFrames: Record<string, unknown> };
    for (const key of Object.keys(frames)) {
      delete frames[key];
    }
  });
}

// Every test renders each dashboard with both grid flags off first, then with the project's flags, and
// compares the two. In the default project both are react-grid-layout, which shows the comparison itself is
// stable; with E2E_NEW_GRID_VIEW=1 the second is the new custom grid
test.describe(
  'Dashboard custom grid rendering parity',
  {
    tag: ['@dashboards', '@new-grid-view'],
  },
  () => {
    for (const sample of SAMPLES) {
      test(`renders "${sample.name}" in view mode like react-grid-layout`, async ({ page, selectors, newGridView }) => {
        test.slow();
        await importDashboard(
          page,
          selectors,
          `Custom grid parity - ${sample.name}`,
          sample.dashboard,
          sample.requiresDataSourceSelection
        );

        await reload(page, 'off');
        const expected = await readRendering(page, selectors, sample);
        await reload(page, 'project');
        const actual = await readRendering(page, selectors, sample);

        expect(expected.hasCustomGrid, 'The first rendering should be react-grid-layout').toBe(false);
        expect(actual.hasCustomGrid, 'The second rendering should be the project grid').toBe(newGridView);
        await expectSameRendering(page, actual, expected);
      });
    }

    test.describe('on a small screen', () => {
      test.use({ viewport: { width: 600, height: 1000 } });

      test('stacks the panels like react-grid-layout', async ({ page, selectors, newGridView }) => {
        test.slow();
        const sample = SAMPLES[0];
        await importDashboard(page, selectors, 'Custom grid parity - small screen', sample.dashboard);

        await reload(page, 'off');
        const expected = await readRendering(page, selectors, sample);
        await reload(page, 'project');
        const actual = await readRendering(page, selectors, sample);

        expect(actual.hasCustomGrid).toBe(newGridView);
        await expectSameRendering(page, actual, expected);
      });
    });
  }
);

const PANEL_COUNT = customGridViewDashboard.panels.length;

// Runs in every grid project: the panels must not show up unsized, out of place or moving into place, in
// react-grid-layout as well as in the new custom grid
test.describe(
  'Dashboard custom grid first paint',
  {
    tag: ['@dashboards', '@drag-and-drop', '@new-grid-view'],
  },
  () => {
    test('paints the panels at their positions from the first frame in view mode', async ({ page, selectors }) => {
      await recordGridItemFrames(page);
      await importDashboard(page, selectors, 'Custom grid first paint - view', customGridViewDashboard);
      await page.reload();
      await readRendering(page, selectors, SAMPLES[0]);

      expect(await getMovedGridItems(page)).toEqual({ recorded: PANEL_COUNT, moved: [] });
    });

    test('paints the panels at their positions from the first frame in edit mode', async ({
      page,
      selectors,
      controls,
      unifiedDragAndDrop,
    }) => {
      await recordGridItemFrames(page);
      await importDashboard(page, selectors, 'Custom grid first paint - edit', customGridViewDashboard);
      await readRendering(page, selectors, SAMPLES[0]);
      // With the edit flag alone the new grid mounts when editing starts
      await clearGridItemFrames(page);

      await controls.enterEditMode();
      await readRendering(page, selectors, SAMPLES[0]);

      expect(await page.locator('[data-custom-grid]').count()).toBe(unifiedDragAndDrop ? 1 : 0);
      expect(await getMovedGridItems(page)).toEqual({ recorded: PANEL_COUNT, moved: [] });
    });
  }
);
