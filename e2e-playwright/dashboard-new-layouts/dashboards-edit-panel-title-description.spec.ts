import { test, expect } from './fixtures';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
});

const PAGE_UNDER_TEST = '5SdHCadmz/panel-tests-graph';

test.describe(
  'Dashboard edit - Panel title and description',
  {
    tag: ['@dashboards'],
  },
  () => {
<<<<<<< HEAD
    test('can edit panel title', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const panel = new Panel({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

||||||| 0b66c76e462
    test('can edit panel title and description', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const panel = new Panel({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

=======
    test('can edit panel title and description', async ({ gotoDashboardPage, page, controls, sidebar, panels }) => {
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
>>>>>>> 113d219ea2edf6a168e4c7081d086ea1038f6f1e
      await controls.enterEditMode();

      const oldTitle = /^No Data Points Warning$/;
      await panels.selectByTitle(oldTitle);

      const titleInput = sidebar.panelOptions.getTitleInput();
      await expect(titleInput).toHaveValue(oldTitle);

      const newTitle = `New panel title (${Date.now()})`;
      await titleInput.fill(newTitle);

<<<<<<< HEAD
      await expect(panel.getHeaderByTitle(oldTitle)).toBeHidden();
||||||| 0b66c76e462
      const newDescription = `New panel description (${Date.now()})`;
      await sidebar.panelOptions.getDescriptionTextarea().fill(newDescription);

      await expect(panel.getHeaderByTitle(oldTitle)).toBeHidden();
=======
      const newDescription = `New panel description (${Date.now()})`;
      await sidebar.panelOptions.getDescriptionTextarea().fill(newDescription);

      await expect(panels.getHeader(oldTitle)).toBeHidden();
>>>>>>> 113d219ea2edf6a168e4c7081d086ea1038f6f1e

      const header = panels.getHeader(newTitle);
      await expect(header).toBeVisible();
    });

    test('can edit panel description', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const panel = new Panel({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      await controls.enterEditMode();

      await panel.selectByTitle(/^No Data Points Warning$/);

      const newDescription = `New panel description (${Date.now()})`;
      await sidebar.panelOptions.getDescriptionTextarea().fill(newDescription);

      const header = panel.getHeaderByTitle(/^No Data Points Warning$/);

      // Reveal description tooltip and check that its value is as expected
      const descriptionIcon = header.locator('[data-testid="title-items-container"] > span').first();
      await descriptionIcon.hover();
      await expect(page.getByRole('tooltip')).toHaveText(newDescription);
    });

    test('can edit switch to subtitle description', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const panel = new Panel({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      await controls.enterEditMode();

      await panel.selectByTitle(/^No Data Points Warning$/);

      await sidebar.panelOptions.getDescriptionTextarea().fill('test description');
      await sidebar.panelOptions.getSubtitleSwitch().click();

      await expect(page.getByTestId(selectors.components.Panels.Panel.subtitle)).toContainText('test description');
    });
  }
);
