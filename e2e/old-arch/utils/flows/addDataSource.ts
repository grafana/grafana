import { v4 as uuidv4 } from 'uuid';

import { e2e } from '../index';

export interface AddDataSourceConfig {
  basicAuth: boolean;
  basicAuthPassword: string;
  basicAuthUser: string;
  expectedAlertMessage: string | RegExp;
  form: () => void;
  name: string;
  skipTlsVerify: boolean;
  type: string;
  timeout?: number;
  awaitHealth?: boolean;
}

// @todo this actually returns type `Cypress.Chainable<AddDaaSourceConfig>`
export const addDataSource = (config?: Partial<AddDataSourceConfig>) => {
  const fullConfig: AddDataSourceConfig = {
    basicAuth: false,
    basicAuthPassword: '',
    basicAuthUser: '',
    expectedAlertMessage: 'Data source is working',
    form: () => {},
    name: `e2e-${uuidv4()}`,
    skipTlsVerify: false,
    type: 'TestData',
    ...config,
  };

  const {
    basicAuth,
    basicAuthPassword,
    basicAuthUser,
    expectedAlertMessage,
    form,
    name,
    skipTlsVerify,
    type,
    timeout,
    awaitHealth,
  } = fullConfig;

  if (awaitHealth) {
    cy.intercept(/health/).as('health');
  }

  cy.logToConsole('Adding data source with name:', name);
  e2e.pages.AddDataSource.visit();
  e2e.pages.AddDataSource.dataSourcePluginsV2(type)
    .scrollIntoView()
    .should('be.visible') // prevents flakiness
    .click();

  e2e.pages.DataSource.name().clear();
  e2e.pages.DataSource.name().type(name);

  if (basicAuth) {
    cy.contains('label', 'Basic auth').scrollIntoView().click();
    cy.contains('section', 'Basic Auth Details')
      .should('be.visible')
      .scrollIntoView()
      .within(() => {
        if (basicAuthUser) {
          cy.get('[placeholder=user]').type(basicAuthUser);
        }
        if (basicAuthPassword) {
          cy.get('[placeholder=Password]').type(basicAuthPassword);
        }
      });
  }

  if (skipTlsVerify) {
    cy.contains('label', 'Skip TLS Verify').scrollIntoView().click();
  }

  form();

  e2e.pages.DataSource.saveAndTest().click();

  if (awaitHealth) {
    cy.wait('@health', { timeout: timeout ?? Cypress.config().defaultCommandTimeout });
  }

  // use the timeout passed in if it exists, otherwise, continue to use the default
  e2e.pages.DataSource.alert()
    .should('exist')
    .contains(expectedAlertMessage, {
      timeout: timeout ?? Cypress.config().defaultCommandTimeout,
    });
  cy.logToConsole('Added data source with name:', name);

  return cy.url().then(() => {
    e2e.getScenarioContext().then(({ addedDataSources }) => {
      e2e.setScenarioContext({
        addedDataSources: [...addedDataSources, { name, id: '' }],
      });
    });

    // @todo remove `wrap` when possible
    return cy.wrap(
      {
        config: fullConfig,
      },
      { log: false }
    );
  });
};
