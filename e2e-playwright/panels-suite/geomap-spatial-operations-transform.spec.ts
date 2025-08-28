import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_ID = 'P2jR04WVk';

test.describe(
  'Panels test: Geomap spatial operations',
  {
    tag: ['@panels'],
  },
  () => {
    test('Tests location auto option', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_ID,
        queryParams: new URLSearchParams({ editPanel: '1' }),
      });

      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Transformations')).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Transforms.addTransformationButton).click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.TransformTab.newTransform('Spatial operations'))
        .click();

      const actionLabel = dashboardPage.getByGrafanaSelector(
        selectors.components.Transforms.SpatialOperations.actionLabel
      );
      const actionInput = actionLabel.locator('input');
      await actionInput.fill('Prepare spatial field');
      await actionInput.press('Enter');

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Transforms.SpatialOperations.locationLabel)
      ).toBeVisible();

      const locationLabel = dashboardPage.getByGrafanaSelector(
        selectors.components.Transforms.SpatialOperations.locationLabel
      );
      const locationInput = locationLabel.locator('input');
      await locationInput.fill('Auto');
      await locationInput.press('Enter');

      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleTableView).click({ force: true });
      const tableHeader = page.getByRole('grid').getByRole('row').first();
      await expect(tableHeader).toBeVisible();
      await expect(tableHeader.getByText('Point')).toBeVisible();
    });

    test('Tests location coords option', async ({ gotoDashboardPage, dashboardPage, selectors, page }) => {
      await gotoDashboardPage({ uid: DASHBOARD_ID, queryParams: new URLSearchParams({ editPanel: '1' }) });

      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Transformations')).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Transforms.addTransformationButton).click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.TransformTab.newTransform('Spatial operations'))
        .click();

      const actionLabel = dashboardPage.getByGrafanaSelector(
        selectors.components.Transforms.SpatialOperations.actionLabel
      );
      const actionInput = actionLabel.locator('input');
      await actionInput.fill('Prepare spatial field');
      await actionInput.press('Enter');

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Transforms.SpatialOperations.locationLabel)
      ).toBeVisible();

      const locationLabel = dashboardPage.getByGrafanaSelector(
        selectors.components.Transforms.SpatialOperations.locationLabel
      );
      const locationInput = locationLabel.locator('input');
      await locationInput.fill('Coords');
      await locationInput.press('Enter');

      const latitudeField = dashboardPage.getByGrafanaSelector(
        selectors.components.Transforms.SpatialOperations.location.coords.latitudeFieldLabel
      );
      await expect(latitudeField).toBeVisible();
      const latitudeInput = latitudeField.locator('input');
      await latitudeInput.fill('Lat');
      await latitudeInput.press('Enter');

      const longitudeField = dashboardPage.getByGrafanaSelector(
        selectors.components.Transforms.SpatialOperations.location.coords.longitudeFieldLabel
      );
      await expect(longitudeField).toBeVisible();
      const longitudeInput = longitudeField.locator('input');
      await longitudeInput.fill('Lng');
      await longitudeInput.press('Enter');

      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleTableView).click({ force: true });
      const tableHeader = page.getByRole('grid').getByRole('row').first();
      await expect(tableHeader).toBeVisible();
      await expect(tableHeader.getByText('Point')).toBeVisible();
    });

    test('Tests geoshash field column appears in table view', async ({
      gotoDashboardPage,
      dashboardPage,
      selectors,
      page,
    }) => {
      await gotoDashboardPage({ uid: DASHBOARD_ID, queryParams: new URLSearchParams({ editPanel: '1' }) });

      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Transformations')).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Transforms.addTransformationButton).click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.TransformTab.newTransform('Spatial operations'))
        .click();

      const actionLabel = dashboardPage.getByGrafanaSelector(
        selectors.components.Transforms.SpatialOperations.actionLabel
      );
      const actionInput = actionLabel.locator('input');
      await actionInput.fill('Prepare spatial field');
      await actionInput.press('Enter');

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Transforms.SpatialOperations.locationLabel)
      ).toBeVisible();

      const locationLabel = dashboardPage.getByGrafanaSelector(
        selectors.components.Transforms.SpatialOperations.locationLabel
      );
      const locationInput = locationLabel.locator('input');
      await locationInput.fill('Geohash');
      await locationInput.press('Enter');

      const geohashField = dashboardPage.getByGrafanaSelector(
        selectors.components.Transforms.SpatialOperations.location.geohash.geohashFieldLabel
      );
      await expect(geohashField).toBeVisible();
      const geohashFieldInput = geohashField.locator('input');
      await geohashFieldInput.fill('State');
      await geohashFieldInput.press('Enter');

      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleTableView).click({ force: true });
      const tableHeader = page.getByRole('grid').getByRole('row').first();
      await expect(tableHeader).toBeVisible();
      await expect(tableHeader.getByText('State 1')).toBeVisible();
    });

    test('Tests location lookup option', async ({ gotoDashboardPage, dashboardPage, selectors, page }) => {
      await gotoDashboardPage({ uid: DASHBOARD_ID, queryParams: new URLSearchParams({ editPanel: '1' }) });

      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Transformations')).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Transforms.addTransformationButton).click();

      await dashboardPage
        .getByGrafanaSelector(selectors.components.TransformTab.newTransform('Spatial operations'))
        .click();

      const actionLabel = dashboardPage.getByGrafanaSelector(
        selectors.components.Transforms.SpatialOperations.actionLabel
      );
      const actionInput = actionLabel.locator('input');
      await actionInput.fill('Prepare spatial field');
      await actionInput.press('Enter');

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Transforms.SpatialOperations.locationLabel)
      ).toBeVisible();

      const locationLabel = dashboardPage.getByGrafanaSelector(
        selectors.components.Transforms.SpatialOperations.locationLabel
      );
      const locationInput = locationLabel.locator('input');
      await locationInput.fill('Lookup');
      await locationInput.press('Enter');

      const lookupField = dashboardPage.getByGrafanaSelector(
        selectors.components.Transforms.SpatialOperations.location.lookup.lookupFieldLabel
      );
      await expect(lookupField).toBeVisible();
      const lookupFieldInput = lookupField.locator('input');
      await lookupFieldInput.fill('State');
      await lookupFieldInput.press('Enter');

      const gazetteerField = dashboardPage.getByGrafanaSelector(
        selectors.components.Transforms.SpatialOperations.location.lookup.gazetteerFieldLabel
      );
      await expect(gazetteerField).toBeVisible();
      const gazetteerFieldInput = gazetteerField.locator('input');
      await gazetteerFieldInput.fill('USA States');
      await gazetteerFieldInput.press('Enter');

      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleTableView).click({ force: true });
      const tableHeader = page.getByRole('grid').getByRole('row').first();
      await expect(tableHeader).toBeVisible();
      await expect(tableHeader.getByText('Geometry')).toBeVisible();
    });
  }
);
