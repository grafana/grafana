import { type Locator, type Page } from '@playwright/test';

import { type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { expect, test } from './fixtures';
import { flows } from './helpers';
import { type Canvas, type Controls, type Rows, type Sidebar } from './page-objects';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  viewport: { width: 1920, height: 1080 },
});

test.describe('Dashboard rows', { tag: ['@dashboards'] }, () => {
  test('can change row presentation and preserve it after reload', async ({
    selectors,
    page,
    controls,
    sidebar,
    rows,
    panels,
    canvas,
  }) => {
    await importDashboardWithRow(page, selectors, controls, canvas, 'Row presentation');

    const rowTitle = 'New row';
    const row = rows.getContainer(rowTitle);
    const title = rows.getTitle(rowTitle);
    const rowPanels = panels.getPanels('New panel', row);
    const fillScreen = sidebar.rowOptions.getFillScreenSwitch();
    const hideHeader = sidebar.rowOptions.getHideHeaderSwitch();

    await expect(rowPanels).toHaveCount(3);
    // The plugin-e2e matcher waits the full timeout with .not.toBeChecked().
    await expect(fillScreen).toBeChecked({ checked: false });
    await expect(hideHeader).toBeChecked({ checked: false });

    const initialHeight = (await row.boundingBox())!.height;

    await test.step('Make the row fill the available screen', async () => {
      await sidebar.rowOptions.toggleFillScreen();

      await expect.poll(async () => (await row.boundingBox())!.height).toBeGreaterThan(initialHeight);
      await expect(async () => {
        const rowBox = (await row.boundingBox())!;
        const canvasBox = (await canvas.getContainer().boundingBox())!;
        expect(rowBox.height).toBeGreaterThan(canvasBox.height * 0.9);
      }).toPass();
    });

    await test.step('Hide the header and confirm the row stays expanded in edit mode', async () => {
      await hideHeader.check({ force: true });
      await expectRowHeaderToBeMarkedAsHidden(title);

      await rows.toggle(rowTitle);
      await expect(rows.getToggle(rowTitle)).toHaveAttribute('aria-expanded', 'true');
      await expect(rowPanels).toHaveCount(3);
      await expect(rowPanels.first()).toBeVisible();
    });

    await flows.dashboards.saveDashboard(page, controls, { reloadPageAfterSave: false });
    await controls.exitEditMode();

    await test.step('Check that view mode hides the header and collapse control', async () => {
      await expect(rowPanels.first()).toBeVisible();
      await expect(title).toBeHidden();
      await expect(rows.getToggle(rowTitle)).toBeHidden();

      await expect(async () => {
        const rowBox = (await row.boundingBox())!;
        const panelBox = (await rowPanels.first().boundingBox())!;
        expect(Math.abs(panelBox.y - rowBox.y)).toBeLessThanOrEqual(1);
      }).toPass();
    });

    await page.reload();

    await expect(rowPanels.first()).toBeVisible();
    await expect(title).toBeHidden();
    await expect(rows.getToggle(rowTitle)).toBeHidden();
    await expect.poll(async () => (await row.boundingBox())!.height).toBeGreaterThan(initialHeight);

    await controls.enterEditMode();
    await rows.select(rowTitle);
    await expect(fillScreen).toBeChecked();
    await expect(hideHeader).toBeChecked();
    await expectRowHeaderToBeMarkedAsHidden(title);
  });

  test('can preserve collapsed rows after reload and toggle top-level rows with keyboard shortcuts', async ({
    selectors,
    page,
    controls,
    rows,
    panels,
    canvas,
    sidebar,
  }) => {
    await test.step('Prepare a dashboard with two rows', async () => {
      await importDashboardWithRow(page, selectors, controls, canvas, 'Row collapse state');
      await sidebar.rowOptions.setTitle('Overview');
      await addRow(canvas, rows, sidebar, 'Details');
      await flows.dashboards.saveDashboard(page, controls, { reloadPageAfterSave: false });
      await controls.exitEditMode();
    });

    const overviewPanel = panels.getPanel('New panel', rows.getContent('Overview'));
    const detailsPanel = panels.getPanel('New panel', rows.getContent('Details'));

    await test.step('Verify collapsing rows hides their panels in view and edit modes', async () => {
      await expect(overviewPanel).toBeVisible();
      await rows.toggle('Overview');
      await expect(rows.getToggle('Overview')).toHaveAttribute('aria-expanded', 'false');
      await expect(overviewPanel).toBeHidden();

      await controls.enterEditMode();
      await expect(detailsPanel).toBeVisible();
      await rows.toggle('Details');
      await expect(detailsPanel).toBeHidden();
    });

    await test.step('Check that collapsed rows stay collapsed after save and reload', async () => {
      await flows.dashboards.saveDashboard(page, controls);

      for (const title of ['Overview', 'Details']) {
        await expect(rows.getToggle(title)).toHaveAttribute('aria-expanded', 'false');
        await expect(rows.getContent(title)).toBeHidden();
      }
    });

    await test.step('Expand both collapsed rows with the keyboard shortcut', async () => {
      await page.keyboard.press('d'); // Start the dashboard shortcut sequence.
      await page.keyboard.press('Shift+E'); // Expand all rows.
      await expect(overviewPanel).toBeVisible();
      await expect(detailsPanel).toBeVisible();
    });

    await test.step('Collapse and expand both rows using keyboard shortcuts', async () => {
      await page.keyboard.press('d'); // Start the dashboard shortcut sequence.
      await page.keyboard.press('Shift+C'); // Collapse all rows.
      for (const title of ['Overview', 'Details']) {
        await expect(rows.getToggle(title)).toHaveAttribute('aria-expanded', 'false');
        await expect(rows.getContent(title)).toBeHidden();
      }

      await page.keyboard.press('d');
      await page.keyboard.press('Shift+E');

      for (const title of ['Overview', 'Details']) {
        await expect(rows.getToggle(title)).toHaveAttribute('aria-expanded', 'true');
        await expect(rows.getContent(title)).toBeVisible();
      }

      await expect(overviewPanel).toBeVisible();
      await expect(detailsPanel).toBeVisible();
    });
  });

  test.describe('Row links', () => {
    // Keep the imported custom-grid row taller than the available canvas so scrolling is required.
    test.use({ viewport: { width: 1920, height: 600 } });

    test('can copy a row link that scrolls to and expands a saved collapsed row', async ({
      selectors,
      page,
      controls,
      rows,
      canvas,
      sidebar,
      createNewDashboardPage,
    }) => {
      await test.step('Prepare a dashboard with a row below the initial viewport', async () => {
        await importDashboardWithRow(page, selectors, controls, canvas, 'Row links');
        await sidebar.rowOptions.setTitle('Overview');
        await addRow(canvas, rows, sidebar, 'Details');
        await flows.dashboards.saveDashboard(page, controls, { reloadPageAfterSave: false });
        await controls.exitEditMode();
      });

      const rowTitle = 'Details';
      const copiedUrl = await test.step('Check that the row link is revealed on hover and can be copied', async () => {
        const copyLink = rows.getCopyLinkButton(rowTitle);
        await expectCopyLinkToBeHidden(copyLink);
        await rows.getTitle(rowTitle).hover();
        await expectCopyLinkToBeVisible(copyLink);
        await copyLink.click();

        const expectedUrl = new URL(page.url());
        expectedUrl.searchParams.set('drow', 'Details');
        await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expectedUrl.href);
        return page.evaluate(() => navigator.clipboard.readText());
      });

      const {
        page: linkedPage,
        rows: linkedRows,
        controls: linkedControls,
      } = await test.step('Verify that the collapsed row stays collapsed after save and reload', async () => {
        await rows.toggle(rowTitle);
        await expect(rows.getContent(rowTitle)).toBeHidden();
        await controls.enterEditMode();
        await flows.dashboards.saveDashboard(page, controls, { reloadPageAfterSave: false });

        // Establish that the saved row is collapsed and offscreen without the deep link.
        const dashboardUrl = new URL(copiedUrl);
        dashboardUrl.searchParams.delete('drow');
        const linkedDashboard = await createNewDashboardPage(dashboardUrl.href);
        await expect(linkedDashboard.rows.getToggle(rowTitle)).toHaveAttribute('aria-expanded', 'false');
        await expect(linkedDashboard.rows.getContent(rowTitle)).toBeHidden();
        await expect(linkedDashboard.rows.getTitle(rowTitle)).not.toBeInViewport();
        return linkedDashboard;
      });

      await test.step('Open the copied link and verify the row expands into view', async () => {
        await linkedPage.goto(copiedUrl);
        await expect(linkedRows.getToggle(rowTitle)).toHaveAttribute('aria-expanded', 'true');
        await expect(linkedRows.getContent(rowTitle)).toBeVisible();
        await expect(linkedRows.getTitle(rowTitle)).toBeInViewport();
      });

      await test.step('Check that, in edit mode, the row is visible but its copy action is absent', async () => {
        await linkedControls.enterEditMode();
        await linkedRows.getTitle(rowTitle).hover();
        await expect(linkedRows.getTitle(rowTitle)).toBeVisible();
        await expect(linkedRows.getCopyLinkButton(rowTitle)).toBeHidden();
      });
    });
  });
});

async function importDashboardWithRow(
  page: Page,
  selectors: E2ESelectorGroups,
  controls: Controls,
  canvas: Canvas,
  title: string
) {
  await test.step(`Prepare a new test dashboard "${title}"`, async () => {
    await flows.dashboards.importTestDashboard(page, selectors, title);
    await controls.enterEditMode();
    await canvas.groupPanels('row');
  });
}

async function addRow(canvas: Canvas, rows: Rows, sidebar: Sidebar, rowTitle: string) {
  await test.step(`Add row "${rowTitle}" with a panel`, async () => {
    await canvas.addRow();
    await sidebar.rowOptions.setTitle(rowTitle);
    await canvas.addPanel(rows.getContent(rowTitle));
  });
}

async function expectRowHeaderToBeMarkedAsHidden(title: Locator) {
  await expect(title).toBeVisible();
  await expect(title).toHaveCSS('text-decoration-line', 'line-through');
  await expect(title.getByTestId('icon-eye-slash')).toBeVisible();
}

async function expectCopyLinkToBeHidden(copyLink: Locator) {
  await expect(copyLink).toHaveCSS('opacity', '0');
}

async function expectCopyLinkToBeVisible(copyLink: Locator) {
  await expect(copyLink).toHaveCSS('opacity', '1');
}
