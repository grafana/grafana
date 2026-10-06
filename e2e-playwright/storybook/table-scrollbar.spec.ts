import { test, expect } from '@playwright/test';

test.describe('Table scrollbar geometry', () => {
  for (const refreshed of [false, true]) {
    test(`nested grids do not reserve an unused gutter (refreshed ${refreshed})`, async ({ page }) => {
      await page.goto(
        `/iframe.html?id=plugins-table-ng--nested-scrollbar&viewMode=story&args=tableRefreshEnabled:${refreshed}`
      );
      await page.addStyleTag({
        content: `
        [role="grid"] { scrollbar-width: auto !important; scrollbar-color: auto !important; }
        [role="grid"]::-webkit-scrollbar { display: block !important; width: 15px !important; height: 15px !important; }
      `,
      });
      await page.getByRole('button', { name: 'Expand row', exact: true }).click();
      const nested = page.getByRole('treegrid').getByRole('grid');
      await expect(nested.getByRole('gridcell', { name: 'Last nested row', exact: true })).toBeVisible();
      await expect
        .poll(() =>
          nested.evaluate((element) => ({
            gutter:
              element.offsetWidth -
              element.clientWidth -
              parseFloat(getComputedStyle(element).borderLeftWidth) -
              parseFloat(getComputedStyle(element).borderRightWidth),
            horizontalOverflow: element.scrollWidth > element.clientWidth,
            verticalOverflow: element.scrollHeight > element.clientHeight,
          }))
        )
        .toEqual({ gutter: 0, horizontalOverflow: false, verticalOverflow: false });
    });
  }

  for (const { zoom, refreshed, width = 800.5, wrapText = false, footer = true, rowCount = 8 } of [
    { zoom: 1, refreshed: false },
    { zoom: 0.75, refreshed: false },
    { zoom: 0.67, refreshed: true },
    { zoom: 1, refreshed: false, width: 320.5, wrapText: true, rowCount: 2 },
    { zoom: 1, refreshed: false, footer: false },
  ]) {
    test(`keeps columns stable (zoom ${zoom}, refreshed ${refreshed}, wrapping ${wrapText}, footer ${footer})`, async ({
      page,
    }) => {
      await page.goto(
        `/iframe.html?id=plugins-table-ng--scrollbar-boundary&viewMode=story&args=width:${width};tableRefreshEnabled:${refreshed};wrapText:${wrapText};footer:${footer};rowCount:${rowCount}`
      );
      // Explicit scrollbar styling emulates classic scrollbars on overlay-scrollbar platforms.
      await page.addStyleTag({
        content: `
          body { zoom: ${zoom}; }
          [role="grid"] { scrollbar-width: auto !important; scrollbar-color: auto !important; }
          [role="grid"]::-webkit-scrollbar { display: block !important; width: 15px !important; height: 15px !important; }
        `,
      });
      const grid = page.getByRole('grid');
      await expect(grid.getByRole('columnheader', { name: 'Name', exact: true })).toBeVisible();
      const geometry = () =>
        grid.evaluate((element) => ({
          gutter: element.offsetWidth - element.clientWidth,
          overflowing: element.scrollHeight > element.clientHeight,
          columns: getComputedStyle(element).gridTemplateColumns,
        }));

      await expect.poll(async () => (await geometry()).gutter).toBeGreaterThan(0);
      await expect.poll(async () => (await geometry()).overflowing).toBe(false);
      // Wait for the debounced scrollbar measurement to settle before recording the columns.
      await expect
        .poll(async () => {
          const widths = await grid
            .getByRole('columnheader')
            .evaluateAll((headers) => headers.map((header) => header.getBoundingClientRect().width));
          return widths.reduce((sum, width) => sum + width, 0);
        })
        .toBeLessThan((width - 1) * zoom);
      const initial = await geometry();

      await page.getByRole('button', { name: 'Show more rows', exact: true }).click();
      await expect.poll(async () => (await geometry()).overflowing).toBe(true);
      // Observe several debounce intervals: a single settled frame does not exclude oscillation.
      const states = await grid.evaluate(
        (element) =>
          new Promise<Array<{ gutter: number; columns: string }>>((resolve) => {
            const samples: Array<{ gutter: number; columns: string }> = [];
            const timer = setInterval(() => {
              samples.push({
                gutter: element.offsetWidth - element.clientWidth,
                columns: getComputedStyle(element).gridTemplateColumns,
              });
              if (samples.length === 20) {
                clearInterval(timer);
                resolve(samples);
              }
            }, 50);
          })
      );
      expect(states).toEqual(Array(20).fill({ gutter: initial.gutter, columns: initial.columns }));

      await page.getByRole('button', { name: 'Show fewer rows', exact: true }).click();
      await expect.poll(geometry).toEqual(initial);
    });
  }

  test('does not reserve a gutter for zero-width scrollbars', async ({ page }) => {
    await page.goto('/iframe.html?id=plugins-table-ng--scrollbar-boundary&viewMode=story');
    await page.addStyleTag({ content: '[role="grid"] { scrollbar-width: none !important; }' });
    const grid = page.getByRole('grid');
    await expect(grid.getByRole('columnheader', { name: 'Name', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Show more rows', exact: true }).click();
    await expect
      .poll(() =>
        grid.evaluate((element) => ({
          overflowing: element.scrollHeight > element.clientHeight,
          gutter: element.offsetWidth - element.clientWidth,
          columns: getComputedStyle(element).gridTemplateColumns,
        }))
      )
      .toEqual({ overflowing: true, gutter: 0, columns: '400px 400px' });
  });

  test('preserves horizontal scrolling when minimum column widths exceed the panel', async ({ page }) => {
    await page.goto('/iframe.html?id=plugins-table-ng--scrollbar-boundary&viewMode=story&args=width:90');
    const grid = page.getByRole('grid');
    await expect(grid.getByRole('columnheader', { name: 'Name', exact: true })).toBeVisible();
    await expect.poll(() => grid.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    await grid.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expect.poll(() => grid.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  });
});
