/// <reference types="cypress" />

import { ExportImageComponents } from '../../public/app/features/dashboard-scene/sharing/ExportButton/e2e-selectors/selectors';

describe('Dashboard export image', () => {
  const openDashboard = () => {
    cy.visit('/d/000000012/dashboard-export-image');
  };

  it('should show renderer not available message when renderer is not installed', () => {
    openDashboard();

    // Open export menu
    cy.get('[data-testid="new export button"]').click();
    cy.get('[data-testid="new export button export as image"]').click();

    // Verify renderer not available message
    cy.get(`[${ExportImageComponents.rendererAlert.container}]`).should('be.visible');
    cy.get(`[${ExportImageComponents.rendererAlert.title}]`).should('be.visible');
    cy.get(`[${ExportImageComponents.rendererAlert.description}]`).should('be.visible');
    cy.get(`[${ExportImageComponents.buttons.generate}]`).should('be.disabled');
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
    cy.get('[data-testid="new export button"]').click();
    cy.get('[data-testid="new export button export as image"]').click();

    // Verify format options are visible
    cy.get(`[${ExportImageComponents.formatOptions.container}]`).should('be.visible');
    cy.get(`[${ExportImageComponents.formatOptions.png}]`).should('be.visible');
    cy.get(`[${ExportImageComponents.formatOptions.jpg}]`).should('be.visible');

    // Generate image
    cy.get(`[${ExportImageComponents.buttons.generate}]`).should('be.enabled').click();

    // Verify loading state
    cy.get(`[${ExportImageComponents.preview.loading}]`).should('be.visible');

    // Wait for image generation
    cy.wait('@renderImage');

    // Verify preview and download button
    cy.get(`[${ExportImageComponents.preview.image}]`).should('be.visible');
    cy.get(`[${ExportImageComponents.buttons.download}]`).should('be.visible');
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
    cy.get('[data-testid="new export button"]').click();
    cy.get('[data-testid="new export button export as image"]').click();

    // Generate image
    cy.get(`[${ExportImageComponents.buttons.generate}]`).should('be.enabled').click();

    // Verify loading state
    cy.get(`[${ExportImageComponents.preview.loading}]`).should('be.visible');

    // Wait for error
    cy.wait('@renderImageError');

    // Verify error message
    cy.get(`[${ExportImageComponents.preview.error.container}]`).should('be.visible');
    cy.get(`[${ExportImageComponents.preview.error.title}]`).should('be.visible');
    cy.get(`[${ExportImageComponents.preview.error.message}]`).should('be.visible');
  });
});
