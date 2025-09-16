import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Panels test: Transformations',
  {
    tag: ['@panels'],
  },
  () => {
    test('Tests transformations editor', async ({ selectors, gotoDashboardPage }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: 'TkZXxlNG3',
        queryParams: new URLSearchParams({ editPanel: '47' }),
      });

      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Transformations')).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Transforms.addTransformationButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.TransformTab.newTransform('Reduce')).click();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Transforms.Reduce.calculationsLabel)
      ).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Transforms.Reduce.modeLabel)).toBeVisible();
    });

    test('Tests case where transformations can be disabled and not clear out panel data', async ({
      selectors,
      gotoDashboardPage,
    }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: 'TkZXxlNG3',
        queryParams: new URLSearchParams({ editPanel: '47' }),
      });

      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Transformations')).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Transforms.addTransformationButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.TransformTab.newTransform('Reduce')).click();

      await dashboardPage.getByGrafanaSelector(selectors.components.Transforms.disableTransformationButton).click();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.PanelDataErrorMessage)
      ).toBeHidden();
    });
  }
);
