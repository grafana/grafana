import { type Locator, type Page } from '@playwright/test';

import { type DashboardPage, type E2ESelectorGroups, expect, test } from '@grafana/plugin-e2e';

import type { Panels, Rows, Tabs } from '../page-objects';

/**
 * Pixel- and timing-sensitive mechanics that must stay out of page objects:
 * coordinate-based drag-and-drop and `boundingBox()` geometry.
 *
 * A util IS a mouse/geometry sequence that several specs share (move panel/tab/row,
 * read a box for a later drag). Specs may still keep one-off `toPass()` retries
 * and short mouse sequences inline.
 *
 * A util is NOT:
 * - a user-intent click/fill/select — that belongs to a page object;
 * - multi-step setup or navigation — that belongs in `flows.ts`;
 * - a reusable `expect` bundle — that belongs in `assertions.ts`.
 *
 * Add a new util only when a second spec needs the same mechanics.
 */
export async function dragTo(
  page: Page,
  sourceName: string,
  source: Locator,
  toX: number,
  toY: number,
  options?: { steps?: number }
) {
  await test.step(`Drag ${sourceName} to (${toX}, ${toY})`, async () => {
    // Playwright's locator.dragTo() does not trigger the dnd library (pangea)
    // used by tabs/rows, which requires intermediate mousemove events.
    await source.hover();
    await page.mouse.down();
    await page.mouse.move(toX, toY, { steps: options?.steps ?? 5 });
    await page.mouse.up();
  });
}

export async function getPanelBox(
  panels: Panels,
  panelTitle: string
): Promise<{ x: number; y: number; width: number; height: number }> {
  // boundingBox() is a point-in-time snapshot and stays out of page objects;
  // measures the whole panel <section>, matched exactly by testid
  const boundingBox = await panels.getPanel(panelTitle).boundingBox();
  expect(boundingBox, `Panel "${panelTitle}" should have a bounding box`).not.toBeNull();

  return boundingBox!;
}

/**
 * A point in the left or right half of a panel, a quarter of its width in from that edge and
 * vertically centered: hovering it while dragging aims the drop before or after that panel
 */
export async function getPanelHalfPoint(panels: Panels, panelTitle: string, half: 'left' | 'right'): Promise<Point> {
  const box = await getPanelBox(panels, panelTitle);

  return {
    x: box.x + box.width * (half === 'left' ? 0.25 : 0.75),
    y: box.y + box.height / 2,
  };
}

export async function movePanel(panels: Panels, sourcePanel: string | RegExp, targetPanel: string | RegExp) {
  await test.step(`Move panel "${sourcePanel}" onto "${targetPanel}"`, async () => {
    // Perform drag and drop; pixel-sensitive mechanics stay out of page objects
    await panels.getHeader(sourcePanel).dragTo(panels.getHeader(targetPanel));
  });
}

export async function getTabBox(
  tabs: Tabs,
  tabTitle: string
): Promise<{ x: number; y: number; width: number; height: number }> {
  const tab = tabs.getTitle(tabTitle).first();
  await expect(tab).toBeVisible();
  const boundingBox = await tab.boundingBox();
  return boundingBox!;
}

export async function moveTab(page: Page, tabs: Tabs, sourceTab: string, targetTab: string) {
  await test.step(`Move tab "${sourceTab}" onto "${targetTab}"`, async () => {
    const targetBox = await getTabBox(tabs, targetTab);
    const sourceTabElement = tabs.getTitle(sourceTab).first();

    // Perform drag and drop (dragTo() did not work in this case)
    await sourceTabElement.hover();
    await page.mouse.down();
    // move to adjusted target position (relative to top left)
    await page.mouse.move(targetBox.x + targetBox.width, targetBox.y, { steps: 5 });
    await page.mouse.up();
  });
}

export async function getRowBox(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  rowTitle: string
): Promise<{ x: number; y: number; width: number; height: number }> {
  const row = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper(rowTitle)).first();
  await expect(row).toBeVisible();
  const boundingBox = await row.boundingBox();
  return boundingBox!;
}

export async function moveRow(
  page: Page,
  dashboardPage: DashboardPage,
  rows: Rows,
  selectors: E2ESelectorGroups,
  sourceRow: string,
  targetRow: string
) {
  const targetBox = await getRowBox(dashboardPage, selectors, targetRow);

  // drop below the target row (relative to top left)
  await dragTo(
    page,
    `row "${sourceRow}"`,
    rows.getTitle(sourceRow).first(),
    targetBox.x,
    targetBox.y + targetBox.height
  );
}

type Point = { x: number; y: number };

/** A drag in progress, started by `startPointerDrag`: the pointer button stays pressed until `drop()` */
export interface PointerDrag {
  /**
   * Moves the held pointer over the target, at its center by default
   * @param position offset from the target's top-left corner, like Playwright's `position` option
   */
  moveTo(target: Locator, options?: { position?: Point; steps?: number }): Promise<void>;
  /** Moves the held pointer to viewport coordinates, which may lie outside the viewport */
  moveToPoint(point: Point, options?: { steps?: number }): Promise<void>;
  /** Presses Escape while the pointer is still held */
  pressEscape(): Promise<void>;
  /** Releases the pointer where it currently is */
  drop(): Promise<void>;
}

async function getCenter(target: Locator, position?: Point): Promise<Point> {
  const box = await target.boundingBox();
  expect(box, 'Drag target should have a bounding box').not.toBeNull();

  return position
    ? { x: box!.x + position.x, y: box!.y + position.y }
    : { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

/**
 * Presses the pointer on `source` and nudges it far enough to pass every drag engine's start
 * threshold, then hands back a `PointerDrag` to move and release it in separate steps.
 * Only real pointer events are used (no `locator.dragTo()`, no keyboard dragging), so the
 * gesture stays valid whichever drag-and-drop library the dashboard uses.
 * Pointer moves are interpolated in several steps because drag engines ignore a single jump.
 */
export async function startPointerDrag(
  page: Page,
  sourceName: string,
  source: Locator,
  options?: { position?: Point }
): Promise<PointerDrag> {
  const DEFAULT_STEPS = 10;
  let current: Point = { x: 0, y: 0 };

  const moveToPoint = async (point: Point, { steps = DEFAULT_STEPS }: { steps?: number } = {}) => {
    await page.mouse.move(point.x, point.y, { steps });
    current = point;
  };

  await test.step(`Start dragging ${sourceName}`, async () => {
    await source.scrollIntoViewIfNeeded();
    current = await getCenter(source, options?.position);
    await page.mouse.move(current.x, current.y);
    await page.mouse.down();
    await moveToPoint({ x: current.x, y: current.y + 10 }, { steps: 5 });
  });

  return {
    moveTo: (target, moveOptions) =>
      test.step(`Drag ${sourceName} over target`, async () => {
        await moveToPoint(await getCenter(target, moveOptions?.position), moveOptions);
      }),
    moveToPoint: (point, moveOptions) =>
      test.step(`Drag ${sourceName} to (${point.x}, ${point.y})`, async () => {
        await moveToPoint(point, moveOptions);
      }),
    pressEscape: () =>
      test.step(`Press Escape while dragging ${sourceName}`, async () => {
        await page.keyboard.press('Escape');
      }),
    drop: () =>
      test.step(`Drop ${sourceName} at (${current.x}, ${current.y})`, async () => {
        await page.mouse.up();
      }),
  };
}

export async function undockMegaMenu(dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
  await test.step('Undock the mega menu', async () => {
    await dashboardPage
      .getByGrafanaSelector(selectors.components.NavMenu.Menu)
      .getByRole('button', { name: 'Undock menu' })
      .click();
  });
}
