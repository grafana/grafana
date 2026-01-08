import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_ID = 'c01bf42b-b783-4447-a304-8554cee1843b';
const DATAGRID_CANVAS = 'data-grid-canvas';

test.use({
  featureToggles: {
    enableDatagridEditing: true,
  },
});

// TODO enable this test when panel goes live
test.describe.skip(
  'Datagrid data changes',
  {
    tag: ['@panels'],
  },
  () => {
    test('Tests changing data in the grid', async ({ gotoDashboardPage, selectors, page }) => {
      await gotoDashboardPage({
        uid: DASHBOARD_ID,
        queryParams: new URLSearchParams({ editPanel: '1' }),
      });

      // Edit datagrid which triggers a snapshot query
      await page.locator('.dvn-scroller').click({ position: { x: 200, y: 100 } });
      await expect(page.getByTestId('glide-cell-2-1')).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.type('123');
      await page.keyboard.press('Enter');

      await page.getByTestId('data-testid Confirm Modal Danger Button').click();

      // Delete a cell
      await page.locator('.dvn-scroller').click({ position: { x: 200, y: 200 } });
      await page.keyboard.press('Delete');
      await expect(page.getByTestId('glide-cell-2-4')).toHaveText('0');

      // Delete a selection
      await page.locator('.dvn-scroller').click({ position: { x: 50, y: 100 }, modifiers: ['Shift'] });
      await page.keyboard.press('Delete');
      await expect(page.getByTestId('glide-cell-2-3')).toHaveText('0');
      await expect(page.getByTestId('glide-cell-2-2')).toHaveText('0');
      await expect(page.getByTestId('glide-cell-2-1')).toHaveText('0');
      await expect(page.getByTestId('glide-cell-2-0')).toHaveText('1');
      await expect(page.getByTestId('glide-cell-1-3')).toHaveText('');
      await expect(page.getByTestId('glide-cell-1-2')).toHaveText('');
      await expect(page.getByTestId('glide-cell-1-1')).toHaveText('');
      await expect(page.getByTestId('glide-cell-1-0')).not.toHaveText('');

      // Clear column through context menu
      await page.locator('.dvn-scroller').click({ button: 'right', position: { x: 200, y: 100 } });
      await page.locator('[aria-label="Context menu"]').click({ position: { x: 100, y: 120 } }); // click clear column
      await expect(page.getByTestId('glide-cell-2-0')).toHaveText('0');
      await expect(page.getByTestId('glide-cell-2-4')).toHaveText('0');

      // Clear row through context menu
      await page.locator('.dvn-scroller').click({ position: { x: 200, y: 220 } });
      await page.keyboard.type('1123');
      await page.keyboard.press('Enter');
      await page.locator('.dvn-scroller').click({ button: 'right', position: { x: 200, y: 220 } });
      await page.locator('[aria-label="Context menu"]').click({ position: { x: 100, y: 100 } }); // click clear row
      await expect(page.getByTestId('glide-cell-1-4')).toHaveText('');
      await expect(page.getByTestId('glide-cell-2-4')).toHaveText('0');

      // get the data back
      await page.reload();

      // Clear row through row selector
      await page.locator('.dvn-scroller').click({ position: { x: 20, y: 190 } });
      await page.locator('.dvn-scroller').click({ position: { x: 20, y: 90 }, modifiers: ['Shift'] }); // with shift to select all rows between clicks
      await page.keyboard.press('Delete');
      await page.getByTestId('data-testid Confirm Modal Danger Button').click();
      await expect(page.getByTestId('glide-cell-1-4')).toHaveText('');
      await expect(page.getByTestId('glide-cell-1-3')).toHaveText('');
      await expect(page.getByTestId('glide-cell-1-2')).toHaveText('');
      await expect(page.getByTestId('glide-cell-1-1')).toHaveText('');
      await expect(page.getByTestId('glide-cell-2-4')).toHaveText('0');
      await expect(page.getByTestId('glide-cell-2-3')).toHaveText('0');
      await expect(page.getByTestId('glide-cell-2-2')).toHaveText('0');
      await expect(page.getByTestId('glide-cell-2-1')).toHaveText('0');
      await page.reload();
      await page.locator('.dvn-scroller').click({ position: { x: 20, y: 190 } });
      await page.locator('.dvn-scroller').click({ position: { x: 20, y: 90 }, modifiers: ['Meta'] }); // with cmd to select only clicked rows
      await page.keyboard.press('Delete');

      await page.getByTestId('data-testid Confirm Modal Danger Button').click();

      await expect(page.getByTestId('glide-cell-1-1')).toHaveText('');
      await expect(page.getByTestId('glide-cell-2-1')).toHaveText('0');
      await expect(page.getByTestId('glide-cell-2-4')).toHaveText('0');
      await expect(page.getByTestId('glide-cell-1-4')).toHaveText('');

      // Remove all data
      await page.locator('.dvn-scroller').click({ button: 'right', position: { x: 100, y: 100 } });
      await page.locator('body').click({ position: { x: 150, y: 420 } });
      await expect(page.getByTestId(DATAGRID_CANVAS).locator('th')).toHaveCount(0);

      await page.reload();

      // Delete column through header dropdown menu
      await page.locator('.dvn-scroller').click({ position: { x: 250, y: 15 } }); // click header dropdown
      await page.locator('body').click({ position: { x: 450, y: 420 } }); // click delete column
      await page.getByTestId('data-testid Confirm Modal Danger Button').click();
      await expect(page.getByTestId(DATAGRID_CANVAS).locator('th')).toHaveCount(1);

      // Delete row through context menu
      await page.locator('.dvn-scroller').click({ button: 'right', position: { x: 100, y: 100 } });
      await page.locator('[aria-label="Context menu"]').click({ position: { x: 10, y: 10 } });
      await expect(page.getByTestId(DATAGRID_CANVAS).locator('tbody tr')).toHaveCount(6); // there are 5 data rows + 1 for the add new row btns

      // Delete rows through row selector
      await page.locator('.dvn-scroller').click({ position: { x: 20, y: 190 } });
      await page.locator('.dvn-scroller').click({ position: { x: 20, y: 90 }, modifiers: ['Shift'] }); // with shift to select all rows between clicks
      await page.locator('.dvn-scroller').click({ button: 'right', position: { x: 100, y: 100 } });
      await page.locator('[aria-label="Context menu"]').click({ position: { x: 10, y: 10 } });
      await expect(page.getByTestId(DATAGRID_CANVAS).locator('tbody tr')).toHaveCount(2); // there are 1 data rows + 1 for the add new row btns
      await page.reload();
      await page.locator('.dvn-scroller').click({ position: { x: 20, y: 190 } });
      await page.locator('.dvn-scroller').click({ position: { x: 20, y: 90 }, modifiers: ['Meta'] }); // with cmd to select only clicked rows
      await page.locator('.dvn-scroller').click({ button: 'right', position: { x: 40, y: 90 } });
      await page.locator('[aria-label="Context menu"]').click({ position: { x: 10, y: 10 } });
      await page.getByTestId('data-testid Confirm Modal Danger Button').click();
      await expect(page.getByTestId(DATAGRID_CANVAS).locator('tbody tr')).toHaveCount(5); // there are 5 data rows + 1 for the add new row btns

      // Delete column through context menu
      await page.locator('.dvn-scroller').click({ button: 'right', position: { x: 100, y: 100 } });
      await page.locator('[aria-label="Context menu"]').click({ position: { x: 10, y: 50 } });
      await expect(page.getByTestId(DATAGRID_CANVAS).locator('th')).toHaveCount(1);

      await page.reload();

      // Add a new column
      await page.locator('body').click({ position: { x: 350, y: 200 } });
      await page.keyboard.type('New Column');
      await page.keyboard.press('Enter');
      await page.getByTestId('data-testid Confirm Modal Danger Button').click();
      await page.locator('body').click({ position: { x: 350, y: 230 } });
      await page.keyboard.type('Value 1');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Value 2');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Value 3');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Value 4');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Value 5');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Value 6');
      await page.keyboard.press('Enter');
      await expect(page.getByTestId(DATAGRID_CANVAS).locator('th')).toHaveCount(3);

      // Rename a column
      await page.locator('.dvn-scroller').click({ position: { x: 250, y: 15 } }); // click header dropdown
      await page.locator('body').click({ position: { x: 450, y: 380 } });
      await page.keyboard.press('Control+a'); // select all
      await page.keyboard.press('Backspace');
      await page.keyboard.type('Renamed column');
      await page.keyboard.press('Enter');
      await expect(page.getByTestId(DATAGRID_CANVAS).locator('th')).toContainText('Renamed column');

      // Change column field type
      await page.locator('.dvn-scroller').click({ position: { x: 310, y: 15 } });
      await page.locator('[aria-label="Context menu"]').click({ position: { x: 50, y: 50 } });
      await page.locator('.dvn-scroller').click({ position: { x: 200, y: 100 } });
      await page.keyboard.type('Str Value');
      await page.keyboard.press('Enter');
      await expect(page.getByTestId(DATAGRID_CANVAS).locator('tr')).toContainText('Str Value');

      // Select all rows through row selection
      await page.locator('.dvn-scroller').click({ position: { x: 10, y: 10 } });
      await expect(page.getByTestId(DATAGRID_CANVAS).locator('[aria-selected="true"]')).toHaveCount(6);

      // Add a new row
      await page.locator('.dvn-scroller').click({ position: { x: 200, y: 250 } });
      await page.keyboard.type('123');
      await page.locator('.dvn-scroller').click({ position: { x: 50, y: 250 } });
      await page.keyboard.type('Val');
      await page.keyboard.press('Enter');
      await expect(page.getByTestId(DATAGRID_CANVAS).locator('tbody tr')).toContainText('Val');
      await expect(page.getByTestId(DATAGRID_CANVAS).locator('tbody tr')).toHaveCount(8);
    });
  }
);
