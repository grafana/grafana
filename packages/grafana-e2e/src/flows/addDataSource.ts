import { v4 as uuidv4 } from 'uuid';

import { e2e } from '../index';

import { DeleteDataSourceConfig } from './deleteDataSource';

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
  } = fullConfig;

  e2e().logToConsole('Adding data source with name:', name);
  e2e.pages.AddDataSource.visit();
  e2e.pages.AddDataSource.dataSourcePluginsV2(type)
    .scrollIntoView()
    .should('be.visible') // prevents flakiness
    .click();

  e2e.pages.DataSource.name().clear();
  e2e.pages.DataSource.name().type(name);

  if (basicAuth) {
    e2e().contains('label', 'Basic auth').scrollIntoView().click();
    e2e()
      .contains('.gf-form-group', 'Basic Auth Details')
      .should('be.visible')
      .scrollIntoView()
      .within(() => {
        if (basicAuthUser) {
          e2e().get('[placeholder=user]').type(basicAuthUser);
        }
        if (basicAuthPassword) {
          e2e().get('[placeholder=Password]').type(basicAuthPassword);
        }
      });
  }

  if (skipTlsVerify) {
    e2e().contains('label', 'Skip TLS Verify').scrollIntoView().click();
  }

  form();

  e2e.pages.DataSource.saveAndTest().click();

  // use the timeout passed in if it exists, otherwise, continue to use the default
  e2e.pages.DataSource.alert()
    .should('exist')
    .contains(expectedAlertMessage, {
      timeout: timeout ?? e2e.config().defaultCommandTimeout,
    });
  e2e().logToConsole('Added data source with name:', name);

  return e2e()
    .url()
    .then(() => {
      e2e.getScenarioContext().then(({ addedDataSources }: any) => {
        e2e.setScenarioContext({
          addedDataSources: [...addedDataSources, { name } as DeleteDataSourceConfig],
        });
      });

      // @todo remove `wrap` when possible
      return e2e().wrap(
        {
          config: fullConfig,
        },
        { log: false }
      );
    });
};
