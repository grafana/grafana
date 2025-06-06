import { e2e } from '../utils';

const PROMETHEUS_DATASOURCE_ID = 'Prometheus';
const TESTDATA_DATASOURCE_ID = 'TestData DB';
const TEST_DATASOURCE_NAME = 'E2E Test Datasource';
const TEST_DESCRIPTION = 'This is a test description for e2e testing';
const UPDATED_DESCRIPTION = 'Updated test description for verification';

describe('Datasource Description Field', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'), true);
  });

  it('should display description field on Prometheus datasource settings page', () => {
    // Navigate to add datasource page
    e2e.pages.AddDataSource.visit();
    e2e.pages.AddDataSource.dataSourcePluginsV2(PROMETHEUS_DATASOURCE_ID)
      .scrollIntoView()
      .should('be.visible')
      .click({ force: true });

    // Verify description field exists
    e2e.pages.DataSource.description().should('exist').should('be.visible');

    // Verify it's a textarea field
    e2e.pages.DataSource.description().should('match', 'textarea');

    // Verify placeholder or label
    e2e.pages.DataSource.description().should('have.attr', 'placeholder').should('not.be.empty');
  });

  it('should display description field on TestData datasource settings page', () => {
    // Navigate to add datasource page
    e2e.pages.AddDataSource.visit();
    e2e.pages.AddDataSource.dataSourcePluginsV2(TESTDATA_DATASOURCE_ID)
      .scrollIntoView()
      .should('be.visible')
      .click({ force: true });

    // Verify description field exists
    e2e.pages.DataSource.description().should('exist').should('be.visible');
  });

  it('should allow user to add and save a description for a new datasource', () => {
    // Navigate to add datasource page
    e2e.pages.AddDataSource.visit();
    e2e.pages.AddDataSource.dataSourcePluginsV2(PROMETHEUS_DATASOURCE_ID)
      .scrollIntoView()
      .should('be.visible')
      .click({ force: true });

    // Fill in required fields
    e2e.components.DataSource.Prometheus.configPage.connectionSettings().type('http://prometheus:9090');
    e2e.pages.DataSource.name().clear().type(TEST_DATASOURCE_NAME);

    // Add description
    e2e.pages.DataSource.description().clear().type(TEST_DESCRIPTION);

    // Verify description was entered
    e2e.pages.DataSource.description().should('have.value', TEST_DESCRIPTION);

    // Save datasource
    e2e.pages.DataSource.saveAndTest().click();

    // Wait for save confirmation
    e2e.pages.DataSource.alert().should('exist');
  });

  it('should persist description after saving and editing datasource', () => {
    // Navigate to add datasource page
    e2e.pages.AddDataSource.visit();
    e2e.pages.AddDataSource.dataSourcePluginsV2(TESTDATA_DATASOURCE_ID)
      .scrollIntoView()
      .should('be.visible')
      .click({ force: true });

    // Fill in required fields
    e2e.pages.DataSource.name().clear().type(`${TEST_DATASOURCE_NAME}_persist`);

    // Add description
    e2e.pages.DataSource.description().clear().type(TEST_DESCRIPTION);

    // Save datasource
    e2e.pages.DataSource.saveAndTest().click();

    // Wait for save confirmation
    e2e.pages.DataSource.alert().should('exist');

    // Refresh the page to verify persistence
    cy.reload();

    // Verify description persisted
    e2e.pages.DataSource.description().should('have.value', TEST_DESCRIPTION);

    // Verify name persisted as well (sanity check)
    e2e.pages.DataSource.name().should('have.value', `${TEST_DATASOURCE_NAME}_persist`);
  });

  it('should allow user to edit existing description', () => {
    // Navigate to add datasource page
    e2e.pages.AddDataSource.visit();
    e2e.pages.AddDataSource.dataSourcePluginsV2(TESTDATA_DATASOURCE_ID)
      .scrollIntoView()
      .should('be.visible')
      .click({ force: true });

    // Fill in required fields
    e2e.pages.DataSource.name().clear().type(`${TEST_DATASOURCE_NAME}_edit`);

    // Add initial description
    e2e.pages.DataSource.description().clear().type(TEST_DESCRIPTION);

    // Save datasource
    e2e.pages.DataSource.saveAndTest().click();

    // Wait for save confirmation
    e2e.pages.DataSource.alert().should('exist');

    // Edit description
    e2e.pages.DataSource.description().clear().type(UPDATED_DESCRIPTION);

    // Verify updated description
    e2e.pages.DataSource.description().should('have.value', UPDATED_DESCRIPTION);

    // Save again
    e2e.pages.DataSource.saveAndTest().click();

    // Wait for save confirmation
    e2e.pages.DataSource.alert().should('exist');

    // Refresh to verify updated description persisted
    cy.reload();
    e2e.pages.DataSource.description().should('have.value', UPDATED_DESCRIPTION);
  });

  it('should allow empty description (optional field)', () => {
    // Navigate to add datasource page
    e2e.pages.AddDataSource.visit();
    e2e.pages.AddDataSource.dataSourcePluginsV2(TESTDATA_DATASOURCE_ID)
      .scrollIntoView()
      .should('be.visible')
      .click({ force: true });

    // Fill in required fields but leave description empty
    e2e.pages.DataSource.name().clear().type(`${TEST_DATASOURCE_NAME}_empty`);

    // Verify description field is empty
    e2e.pages.DataSource.description().should('have.value', '');

    // Save datasource without description
    e2e.pages.DataSource.saveAndTest().click();

    // Wait for save confirmation - should succeed
    e2e.pages.DataSource.alert().should('exist');

    // Verify name was saved (sanity check)
    e2e.pages.DataSource.name().should('have.value', `${TEST_DATASOURCE_NAME}_empty`);

    // Verify description remained empty
    e2e.pages.DataSource.description().should('have.value', '');
  });

  it('should handle long descriptions gracefully', () => {
    const longDescription = 'A'.repeat(500); // Very long description

    // Navigate to add datasource page
    e2e.pages.AddDataSource.visit();
    e2e.pages.AddDataSource.dataSourcePluginsV2(TESTDATA_DATASOURCE_ID)
      .scrollIntoView()
      .should('be.visible')
      .click({ force: true });

    // Fill in required fields
    e2e.pages.DataSource.name().clear().type(`${TEST_DATASOURCE_NAME}_long`);

    // Add long description
    e2e.pages.DataSource.description().clear().type(longDescription);

    // Verify long description was entered
    e2e.pages.DataSource.description().should('have.value', longDescription);

    // Save datasource
    e2e.pages.DataSource.saveAndTest().click();

    // Wait for save confirmation
    e2e.pages.DataSource.alert().should('exist');

    // Verify long description persisted
    e2e.pages.DataSource.description().should('have.value', longDescription);
  });

  it('should display description field in correct location on settings page', () => {
    // Navigate to add datasource page
    e2e.pages.AddDataSource.visit();
    e2e.pages.AddDataSource.dataSourcePluginsV2(PROMETHEUS_DATASOURCE_ID)
      .scrollIntoView()
      .should('be.visible')
      .click({ force: true });

    // Verify description field appears after name field
    e2e.pages.DataSource.name().should('be.visible');
    e2e.pages.DataSource.description().should('be.visible');

    // Verify both fields are in the settings section
    e2e.pages.DataSource.name().should('be.visible');
    e2e.pages.DataSource.description().should('be.visible');

    // Test tab navigation between name and description
    e2e.pages.DataSource.name().focus();
    e2e.pages.DataSource.name().tab();
    e2e.pages.DataSource.description().should('be.focused');
  });

  afterEach(() => {
    // Clean up test datasources by navigating to datasources list and removing any test datasources
    e2e.pages.DataSources.visit();

    // Try to clean up any datasources that start with our test name
    cy.get('body').then(($body) => {
      if ($body.find(`[data-testid*="${TEST_DATASOURCE_NAME}"]`).length > 0) {
        cy.get(`[data-testid*="${TEST_DATASOURCE_NAME}"]`).each(($el) => {
          cy.wrap($el).click();
          e2e.pages.DataSource.delete().click();
          cy.get('[data-testid="Confirm Modal Danger Button"]').click();
        });
      }
    });
  });
});
