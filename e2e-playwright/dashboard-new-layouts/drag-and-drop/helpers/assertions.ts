import test, { expect } from '@playwright/test';

import { getPanelBox } from '../../helpers';
import { type Panels, type Rows } from '../../page-objects';

/** Marks a row as collapsed in `expectRowsToHold`: a collapsed row does not render its panels */
export const COLLAPSED_ROW = 'collapsed' as const;

/**
 * Asserts the rows layout holds exactly these rows, in display order, each either expanded with
 * exactly the given panels (in order) or collapsed
 */
export async function expectRowsToHold(
  rows: Rows,
  panels: Panels,
  expectedRows: Record<string, string[] | typeof COLLAPSED_ROW>
) {
  const summary = Object.entries(expectedRows)
    .map(([rowTitle, content]) => `${rowTitle}: ${content === COLLAPSED_ROW ? content : `[${content.join(', ')}]`}`)
    .join('; ');

  await test.step(`Expect rows ${summary}`, async () => {
    await expect(rows.getTitles()).toHaveText(Object.keys(expectedRows));
    for (const [rowTitle, content] of Object.entries(expectedRows)) {
      if (content === COLLAPSED_ROW) {
        await expect(rows.getToggle(rowTitle)).toHaveAttribute('aria-expanded', 'false');
        await expect(rows.getContent(rowTitle)).toHaveCount(0);
      } else {
        await expect(rows.getToggle(rowTitle)).toHaveAttribute('aria-expanded', 'true');
        await expect(panels.getHeaders(undefined, rows.getContent(rowTitle))).toHaveText(content);
      }
    }
  });
}

/**
 * Asserts every panel's box matches the expected one within `tolerance` pixels, retrying while the
 * layout settles (drop animations, reflow after undo/redo or a reload)
 */
export async function expectPanelBoxesToBe(
  panels: Panels,
  expectedBoxes: Record<string, { x: number; y: number; width: number; height: number }>,
  tolerance = 2
) {
  await test.step(`Expect the boxes of ${Object.keys(expectedBoxes).join(', ')}`, async () => {
    await expect(async () => {
      for (const [title, expected] of Object.entries(expectedBoxes)) {
        const box = await getPanelBox(panels, title);
        for (const key of ['x', 'y', 'width', 'height'] as const) {
          expect(Math.abs(box[key] - expected[key]), `"${title}" ${key}`).toBeLessThanOrEqual(tolerance);
        }
      }
    }).toPass();
  });
}
