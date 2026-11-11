import { expect, test } from './fixtures';

test.use({
  featureToggles: {
    dashboardUndoRedo: true,
  },
});

const PAGE_UNDER_TEST = 'edediimbjhdz4b/a-tall-dashboard';

test.describe(
  'Dashboard Outline',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can use dashboard outline', async ({ gotoDashboardPage, selectors, controls, sidebar, panels }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Outline');

      // Should be able to click Variables item in outline to see add variable button
      await sidebar.contentOutline.clickItem('Variables');
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.ElementEditPane.addVariableButton)
      ).toBeVisible();

      await sidebar.toolbar.clickButton('Outline');

      // Clicking a panel should scroll that panel in view. Scoped to the panel body, because selecting
      // the text panel also shows its content in the edit pane.
      const panelContent = panels.getBody('Panel #48').getByText('Dashboard panel 48');
      await expect(panelContent).not.toBeInViewport();

      await sidebar.contentOutline.clickItem('Panel #48');
      await expect(panelContent).toBeInViewport();
    });

    test('outline expanded state persists after closing and reopening the pane', async ({
      gotoDashboardPage,
      controls,
      sidebar,
    }) => {
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Outline');

      const outlineTree = sidebar.contentOutline.getTree();
      const emptyIndicator = outlineTree.getByText('(empty)').first();

      await expect(emptyIndicator).not.toBeVisible();

      await sidebar.contentOutline.toggleNode('Variables');
      await expect(emptyIndicator).toBeVisible();

      await sidebar.toolbar.clickButton('Outline');
      await expect(outlineTree).not.toBeVisible();

      await sidebar.toolbar.clickButton('Outline');
      await expect(emptyIndicator).toBeVisible();
    });

    test('outline expanded state persists after discarding edit mode changes', async ({
      gotoDashboardPage,
      controls,
      sidebar,
    }) => {
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Outline');

      const outlineTree = sidebar.contentOutline.getTree();

      await sidebar.contentOutline.toggleNode('Variables');
      await expect(outlineTree.getByText('(empty)').first()).toBeVisible();

      await controls.exitEditMode();

      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Outline');
      await expect(outlineTree.getByText('(empty)').first()).toBeVisible();
    });
  }
);
