import { type DashboardPage, type DashboardPageArgs } from '@grafana/plugin-e2e';

import { expect, test } from './fixtures';
import { flows } from './helpers';
import { type Canvas, type Panels, type Rows, type Sidebar, type Tabs } from './page-objects';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  viewport: { width: 1920, height: 1080 },
});

test.describe('Dashboard section actions', { tag: ['@dashboards'] }, () => {
  test.describe('Rows', () => {
    test('can copy, paste, and duplicate a row while preserving its panels and options', async ({
      gotoDashboardPage,
      page,
      controls,
      sidebar,
      panels,
      rows,
      canvas,
    }) => {
      // Distinct titles let the assertions detect missing or reordered panels in each copy.
      await prepareDashboardWithSection(gotoDashboardPage, sidebar, canvas, 'row', ['CPU', 'Memory', 'Latency']);

      await sidebar.rowOptions.setTitle('Service metrics');
      await sidebar.rowOptions.toggleFillScreen();

      const rowTitles = ['Service metrics', 'Service metrics 1', 'Service metrics 2'];
      const pasteRow = canvas.getPasteRowButton();
      const pastePanel = canvas.getPastePanelButton(rows.getContent('Service metrics'));

      await test.step('Offer row paste only after copying a row', async () => {
        await expect(panels.getHeaders(undefined, rows.getContent('Service metrics'))).toHaveText([
          'CPU',
          'Memory',
          'Latency',
        ]);
        await expect(pasteRow).toBeHidden();
        await expect(pastePanel).toBeHidden();

        await panels.selectByTitle('CPU');
        await sidebar.copySelection();
        await expect(pastePanel).toBeVisible();
        await expect(pasteRow).toBeHidden();

        await rows.select('Service metrics');
        await sidebar.copySelection();
        await expect(pasteRow).toBeVisible();
        await canvas.pasteRow();
        await expect(rows.getTitle('Service metrics 1')).toBeVisible();
      });

      await test.step('Duplicate the original without reusing the pasted title', async () => {
        await rows.select('Service metrics');
        await sidebar.duplicateSelection();
        await expect(rows.getTitle('Service metrics 2')).toBeVisible();
      });

      await expectRowCopies(rows, panels, sidebar, rowTitles);

      await flows.dashboards.saveDashboard(page, controls, { title: 'Copy and duplicate rows' });
      await controls.enterEditMode();

      await expectRowCopies(rows, panels, sidebar, rowTitles);
    });

    test('can cancel deleting a populated row and delete the last row into an empty auto grid', async ({
      gotoDashboardPage,
      page,
      controls,
      sidebar,
      panels,
      rows,
      canvas,
    }) => {
      await prepareDashboardWithSection(gotoDashboardPage, sidebar, canvas, 'row');

      await canvas.addRow();

      const dialog = page.getByRole('dialog', { name: 'Delete row?', exact: true });

      await test.step('Delete an empty row (no confirmation required)', async () => {
        await expect(rows.getTitle('New row 1')).toBeVisible();
        await sidebar.deleteSelection();
        await expect(rows.getTitle('New row 1')).toBeHidden();
        await expect(dialog).toBeHidden();
        await expect(panels.getHeaders(undefined, rows.getContent('New row'))).toHaveText([
          'New panel',
          'New panel',
          'New panel',
        ]);
      });

      await test.step('Cancel deletion without losing the row or its panels', async () => {
        await expect(sidebar.rowOptions.getTitleInput()).toHaveValue('New row');
        await sidebar.deleteSelection();
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByText('Deleting this row will also remove all panels. Are you sure you want to continue?', {
            exact: true,
          })
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(rows.getTitle('New row')).toBeVisible();
        await expect(panels.getHeaders(undefined, rows.getContent('New row'))).toHaveText([
          'New panel',
          'New panel',
          'New panel',
        ]);
      });

      await sidebar.deleteSelection({ confirm: true });
      await expectEmptyAutoGrid(canvas, panels, sidebar);
      await expect(rows.getTitle('New row')).toBeHidden();

      await flows.dashboards.saveDashboard(page, controls, { title: 'Delete rows safely' });
      await controls.enterEditMode();
      await expectEmptyAutoGrid(canvas, panels, sidebar);
    });

    test('warns about duplicate row titles and generates a unique title when left empty', async ({
      gotoDashboardPage,
      sidebar,
      rows,
      canvas,
    }) => {
      await prepareDashboardWithSection(gotoDashboardPage, sidebar, canvas, 'row');

      await sidebar.rowOptions.setTitle('Temporary row');
      await sidebar.rowOptions.setTitle('');
      await expect(sidebar.rowOptions.getTitleInput()).toHaveValue('New row');
      await expect(rows.getTitle('New row')).toBeVisible();
      await canvas.addRow();

      const titleInput = sidebar.rowOptions.getTitleInput();
      const titleError = sidebar.getContainer().getByRole('alert').filter({ hasText: 'Title should be unique' });

      await sidebar.rowOptions.setTitle('New row');
      await expect(titleError).toBeVisible();
      await expect(rows.getTitles('New row')).toHaveCount(2);
      await expect(rows.getTitles('New row').nth(1).getByTestId('icon-exclamation-triangle')).toBeVisible();

      await sidebar.rowOptions.setTitle('Corrected row');
      await expect(titleInput).toHaveValue('Corrected row');
      await expect(rows.getTitle('Corrected row')).toBeVisible();
      await expect(titleError).toBeHidden();
      await expect(rows.getTitle('New row').getByTestId('icon-exclamation-triangle')).toBeHidden();
      await expect(rows.getTitle('Corrected row').getByTestId('icon-exclamation-triangle')).toBeHidden();

      await sidebar.rowOptions.setTitle('');
      await expect(titleInput).toHaveValue('New row 1');
      await expect(rows.getTitle('New row 1')).toBeVisible();
      await expect(rows.getTitles('New row')).toHaveCount(1);
      await expect(titleError).toBeHidden();
      await expect(rows.getTitle('New row 1').getByTestId('icon-exclamation-triangle')).toBeHidden();
    });
  });

  test.describe('Tabs', () => {
    test('can copy, paste, and duplicate a tab while preserving its panels and options', async ({
      gotoDashboardPage,
      page,
      controls,
      sidebar,
      panels,
      tabs,
      canvas,
    }) => {
      // Distinct titles let the assertions detect missing or reordered panels in each copy.
      await prepareDashboardWithSection(gotoDashboardPage, sidebar, canvas, 'tab', ['CPU', 'Memory', 'Latency']);

      await sidebar.tabOptions.setTitle('Service metrics');

      const tabTitles = ['Service metrics', 'Service metrics 1', 'Service metrics 2'];
      const gridOptions = sidebar.dashboardOptions.gridLayoutOptions;

      await gridOptions.switchLayout('Auto');
      await gridOptions.selectMaxColumns('2');
      await gridOptions.selectRowHeight('Short');
      await gridOptions.toggleFillScreen();

      const pasteTab = canvas.getPasteTabButton();
      const pastePanel = canvas.getPastePanelButton(tabs.getContent('Service metrics'));

      await test.step('Offer tab paste only after copying a tab', async () => {
        await expect(panels.getHeaders(undefined, tabs.getContent('Service metrics'))).toHaveText([
          'CPU',
          'Memory',
          'Latency',
        ]);
        await expect(pasteTab).toBeHidden();
        await expect(pastePanel).toBeHidden();

        await panels.selectByTitle('CPU');
        await sidebar.copySelection();
        await expect(pastePanel).toBeVisible();
        await expect(pasteTab).toBeHidden();

        await tabs.select('Service metrics');
        await sidebar.copySelection();
        await expect(pasteTab).toBeVisible();
        await canvas.pasteTab();
        await expect(tabs.getTitle('Service metrics 1')).toHaveAttribute('aria-selected', 'true');
        await expect(tabs.getTitles(canvas.getContainer())).toHaveText(['Service metrics', 'Service metrics 1']);
      });

      await test.step('Append a duplicate of the original with a distinct title', async () => {
        await tabs.select('Service metrics');
        await sidebar.duplicateSelection();
        await expect(tabs.getTitle('Service metrics 2')).toHaveAttribute('aria-selected', 'true');
      });

      await expectTabCopies(tabs, panels, sidebar, canvas, tabTitles);

      await flows.dashboards.saveDashboard(page, controls, { title: 'Copy and duplicate tabs' });
      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Options');

      await expectTabCopies(tabs, panels, sidebar, canvas, tabTitles);
    });

    test('can cancel deleting a populated tab, activate a neighbor, and delete the last tab', async ({
      gotoDashboardPage,
      page,
      controls,
      sidebar,
      panels,
      tabs,
      canvas,
    }) => {
      await prepareDashboardWithSection(gotoDashboardPage, sidebar, canvas, 'tab');

      await sidebar.duplicateSelection();
      await canvas.addTab();

      const dialog = page.getByRole('dialog', { name: 'Delete tab?', exact: true });

      await test.step('Delete an empty last tab and activate its neighbor (no confirmation required)', async () => {
        await expect(tabs.getTitle('New tab 2')).toHaveAttribute('aria-selected', 'true');
        await sidebar.deleteSelection();
        await expect(tabs.getTitle('New tab 1')).toHaveAttribute('aria-selected', 'true');
        await expect(tabs.getTitle('New tab 2')).toBeHidden();
        await expect(dialog).toBeHidden();
        await expect(panels.getHeaders(undefined, tabs.getContent('New tab 1'))).toHaveText([
          'New panel',
          'New panel',
          'New panel',
        ]);
      });

      await test.step('Cancel deletion without losing the tab or its panels', async () => {
        await expect(sidebar.tabOptions.getTitleInput()).toHaveValue('New tab 1');
        await sidebar.deleteSelection();
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByText('Deleting this tab will also remove all panels. Are you sure you want to continue?', {
            exact: true,
          })
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(tabs.getTitle('New tab 1')).toHaveAttribute('aria-selected', 'true');
        await expect(panels.getHeaders(undefined, tabs.getContent('New tab 1'))).toHaveText([
          'New panel',
          'New panel',
          'New panel',
        ]);
      });

      await sidebar.deleteSelection({ confirm: true });
      await expect(tabs.getTitle('New tab')).toHaveAttribute('aria-selected', 'true');
      await expect(tabs.getTitle('New tab 1')).toBeHidden();
      await expect(panels.getHeaders(undefined, tabs.getContent('New tab'))).toHaveText([
        'New panel',
        'New panel',
        'New panel',
      ]);

      await expect(sidebar.tabOptions.getTitleInput()).toHaveValue('New tab');
      await sidebar.deleteSelection({ confirm: true });
      await expectEmptyAutoGrid(canvas, panels, sidebar);
      await expect(tabs.getTitle('New tab')).toBeHidden();

      await flows.dashboards.saveDashboard(page, controls, { title: 'Delete tabs safely' });
      await controls.enterEditMode();
      await expectEmptyAutoGrid(canvas, panels, sidebar);
    });

    test('warns about duplicate tab titles and generates a unique title when left empty', async ({
      gotoDashboardPage,
      sidebar,
      tabs,
      canvas,
    }) => {
      await prepareDashboardWithSection(gotoDashboardPage, sidebar, canvas, 'tab');

      await sidebar.tabOptions.setTitle('Temporary tab');
      await sidebar.tabOptions.setTitle('');
      await expect(sidebar.tabOptions.getTitleInput()).toHaveValue('New tab');
      await expect(tabs.getTitle('New tab')).toBeVisible();
      await canvas.addTab();

      const titleInput = sidebar.tabOptions.getTitleInput();
      const titleError = sidebar.getContainer().getByRole('alert').filter({ hasText: 'Title should be unique' });

      await sidebar.tabOptions.setTitle('New tab');
      await expect(titleError).toBeVisible();
      await expect(tabs.getTitles(canvas.getContainer())).toHaveText(['New tab', 'New tab']);
      await expect(tabs.getTitles(canvas.getContainer()).getByTestId('tab-icon-exclamation-triangle')).toHaveCount(2);

      await sidebar.tabOptions.setTitle('Corrected tab');
      await expect(titleInput).toHaveValue('Corrected tab');
      await expect(tabs.getTitle('Corrected tab')).toBeVisible();
      await expect(titleError).toBeHidden();
      await expect(tabs.getTitle('New tab').getByTestId('tab-icon-exclamation-triangle')).toBeHidden();
      await expect(tabs.getTitle('Corrected tab').getByTestId('tab-icon-exclamation-triangle')).toBeHidden();

      await sidebar.tabOptions.setTitle('');
      await expect(titleInput).toHaveValue('New tab 1');
      await expect(tabs.getTitles(canvas.getContainer())).toHaveText(['New tab', 'New tab 1']);
      await expect(titleError).toBeHidden();
      await expect(tabs.getTitle('New tab 1').getByTestId('tab-icon-exclamation-triangle')).toBeHidden();
    });
  });
});

async function prepareDashboardWithSection(
  gotoDashboardPage: (args: DashboardPageArgs) => Promise<DashboardPage>,
  sidebar: Sidebar,
  canvas: Canvas,
  sectionType: 'row' | 'tab',
  panelTitles = ['New panel', 'New panel', 'New panel']
) {
  await test.step(`Prepare a dashboard with a ${sectionType} and panels`, async () => {
    await gotoDashboardPage({});
    for (const [index, title] of panelTitles.entries()) {
      if (index > 0) {
        await sidebar.toolbar.clickButton('Add');
      }
      await sidebar.addOptions.addPanel();
      await sidebar.panelOptions.setTitle(title);
    }
    await canvas.groupPanels(sectionType);
  });
}

async function expectRowCopies(rows: Rows, panels: Panels, sidebar: Sidebar, rowTitles: string[]) {
  await test.step('Check row copies retain their panels, titles, and options', async () => {
    for (const rowTitle of rowTitles) {
      await expect(rows.getTitle(rowTitle)).toBeVisible();
      const content = rows.getContent(rowTitle);
      await content.scrollIntoViewIfNeeded();
      await expect(panels.getHeaders(undefined, content)).toHaveText(['CPU', 'Memory', 'Latency']);
      await rows.select(rowTitle);
      await expect(sidebar.rowOptions.getTitleInput()).toHaveValue(rowTitle);
      await expect(sidebar.rowOptions.getFillScreenSwitch()).toBeChecked();
    }
  });
}

async function expectTabCopies(tabs: Tabs, panels: Panels, sidebar: Sidebar, canvas: Canvas, tabTitles: string[]) {
  await test.step('Check tab copies retain their order, panels, titles, and options', async () => {
    await expect(tabs.getTitles(canvas.getContainer())).toHaveText(tabTitles);
    const gridOptions = sidebar.dashboardOptions.gridLayoutOptions;
    for (const tabTitle of tabTitles) {
      await tabs.select(tabTitle);
      await expect(sidebar.tabOptions.getTitleInput()).toHaveValue(tabTitle);
      await expect(panels.getHeaders(undefined, tabs.getContent(tabTitle))).toHaveText(['CPU', 'Memory', 'Latency']);
      await expect(gridOptions.getLayoutType('Auto')).toBeChecked();
      await expect(gridOptions.getMaxColumnsSelect()).toHaveValue('2');
      await expect(gridOptions.getRowHeightSelect()).toHaveValue('Short');
      await expect(gridOptions.getFillScreenSwitch()).toBeChecked();
    }
  });
}

async function expectEmptyAutoGrid(canvas: Canvas, panels: Panels, sidebar: Sidebar) {
  await test.step('Check the dashboard has an empty auto grid', async () => {
    await expect(canvas.getContainer().getByRole('heading', { name: 'New dashboard', exact: true })).toBeVisible();
    await expect(panels.getHeaders()).toHaveCount(0);
    await sidebar.toolbar.clickButton('Options');
    await expect(sidebar.dashboardOptions.gridLayoutOptions.getLayoutType('Auto')).toBeChecked();
  });
}
