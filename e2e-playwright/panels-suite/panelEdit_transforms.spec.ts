import { test, expect } from '@grafana/plugin-e2e';

const SMOKE_DASHBOARD_UID = 'transforms-smoke';
const PANEL_MULTI_FIELD_TIME_SERIES = '1';

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

    test('Group by editor mounts in the legacy panel edit flow', async ({ selectors, gotoDashboardPage }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: SMOKE_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: PANEL_MULTI_FIELD_TIME_SERIES }),
      });

      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Transformations')).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Transforms.addTransformationButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.TransformTab.newTransform('Group by')).click();

      const editor = dashboardPage.getByGrafanaSelector(
        selectors.components.TransformTab.transformationEditor('Group by')
      );
      await expect(editor).toBeVisible();
      await expect(editor.getByRole('alert', { name: 'An unexpected error happened' })).toBeHidden();
    });

    test('Merge series/tables is flagged as not applicable in the legacy picker', async ({
      selectors,
      gotoDashboardPage,
    }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: SMOKE_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: PANEL_MULTI_FIELD_TIME_SERIES }),
      });

      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Transformations')).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Transforms.addTransformationButton).click();

      const card = dashboardPage.getByGrafanaSelector(
        selectors.components.TransformTab.newTransform('Merge series/tables')
      );
      await expect(card).toBeVisible();

      const applicabilityInfo = card.getByTestId(selectors.components.Transforms.applicabilityInfo);
      await expect(applicabilityInfo).toBeVisible();
      await expect(applicabilityInfo).toHaveAttribute('aria-label', /at least 2 data series/);
    });
  }
);
