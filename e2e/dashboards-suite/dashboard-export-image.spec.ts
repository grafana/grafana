import { e2e } from '../utils';

describe('Dashboard export image', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  const openDashboard = () => {
    cy.intercept({
      pathname: '/api/ds/query',
    }).as('query');
    e2e.flows.openDashboard({
      uid: 'ZqZnVvFZz',
    });
    cy.wait('@query');
  };

  it('should show renderer not available message when renderer is not installed', () => {
    openDashboard();

    // Open export menu
    e2e.pages.Dashboard.DashNav.NewExportButton.arrowMenu().click();
    e2e.pages.Dashboard.DashNav.NewExportButton.Menu.exportAsImage().click();

    // Verify renderer not available message
    e2e.components.ExportImage.rendererAlert.container().should('be.visible');
    e2e.components.ExportImage.rendererAlert.title().should('be.visible');
    e2e.components.ExportImage.rendererAlert.description().should('be.visible');
    e2e.components.ExportImage.buttons.generate().should('be.disabled');
  });

  // TODO: This is a temporary skip until we have a way to mock the renderer plugin
  it.skip('should generate and download dashboard image when renderer is available', () => {
    // Mock the renderer availability
    cy.window().then((win) => {
      if (!win.grafanaBootData) {
        win.grafanaBootData = { settings: {} };
      }
      win.grafanaBootData.settings.rendererAvailable = true;
    });

    // Mock the image generation API response
    cy.intercept('GET', '/render/d-solo/*', {
      statusCode: 200,
      headers: {
        'content-type': 'image/png',
      },
      body: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', // 1x1 transparent PNG
    }).as('renderImage');

    openDashboard();

    // Open export menu
    e2e.pages.Dashboard.DashNav.NewExportButton.arrowMenu().click();
    e2e.pages.Dashboard.DashNav.NewExportButton.Menu.exportAsImage().click();

    // Verify format options are visible
    e2e.components.ExportImage.formatOptions.container().should('be.visible');
    e2e.components.ExportImage.formatOptions.png().should('be.visible');
    e2e.components.ExportImage.formatOptions.jpg().should('be.visible');

    // Generate image
    e2e.components.ExportImage.buttons.generate().should('be.enabled').click();

    // Verify loading state
    e2e.components.ExportImage.preview.loading().should('be.visible');

    // Wait for image generation
    cy.wait('@renderImage');

    // Verify preview and download button
    e2e.components.ExportImage.preview.image().should('be.visible');
    e2e.components.ExportImage.buttons.download().should('be.visible');
  });

  // TODO: This is a temporary skip until we have a way to mock the renderer plugin
  it.skip('should handle image generation errors', () => {
    // Mock the renderer availability
    cy.window().then((win) => {
      if (!win.grafanaBootData) {
        win.grafanaBootData = { settings: {} };
      }
      win.grafanaBootData.settings.rendererAvailable = true;
    });

    // Mock the API call to fail
    cy.intercept('GET', '/render/d-solo/*', {
      statusCode: 500,
      body: 'Internal Server Error',
    }).as('renderImageError');

    openDashboard();

    // Open export menu
    e2e.pages.Dashboard.DashNav.NewExportButton.arrowMenu().click();
    e2e.pages.Dashboard.DashNav.NewExportButton.Menu.exportAsImage().click();

    // Generate image
    e2e.components.ExportImage.buttons.generate().should('be.enabled').click();

    // Verify loading state
    e2e.components.ExportImage.preview.loading().should('be.visible');

    // Wait for error
    cy.wait('@renderImageError');

    // Verify error message
    e2e.components.ExportImage.preview.error.container().should('be.visible');
    e2e.components.ExportImage.preview.error.title().should('be.visible');
    e2e.components.ExportImage.preview.error.message().should('be.visible');
  });
});
