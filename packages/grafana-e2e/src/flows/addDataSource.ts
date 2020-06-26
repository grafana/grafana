import { DeleteDataSourceConfig } from './deleteDataSource';
import { e2e } from '../index';
import { fromBaseUrl, getDataSourceId } from '../support/url';

export interface AddDataSourceConfig {
  checkHealth: boolean;
  expectedAlertMessage: string | RegExp;
  form: Function;
  name: string;
  type: string;
}

// @todo this actually returns type `Cypress.Chainable`
export const addDataSource = (config?: Partial<AddDataSourceConfig>): any => {
  const fullConfig = {
    checkHealth: false,
    expectedAlertMessage: 'Data source is working',
    form: () => {},
    name: `e2e-${Date.now()}`,
    type: 'TestData DB',
    ...config,
  } as AddDataSourceConfig;

  const { checkHealth, expectedAlertMessage, form, name, type } = fullConfig;

  e2e().logToConsole('Adding data source with name:', name);
  e2e.pages.AddDataSource.visit();
  e2e.pages.AddDataSource.dataSourcePlugins(type)
    .scrollIntoView()
    .should('be.visible') // prevents flakiness
    .click();

  e2e.pages.DataSource.name().clear();
  e2e.pages.DataSource.name().type(name);
  form();
  e2e.pages.DataSource.saveAndTest().click();
  e2e.pages.DataSource.alert().should('exist');
  e2e.pages.DataSource.alertMessage().contains(expectedAlertMessage); // assertion
  e2e().logToConsole('Added data source with name:', name);

  return e2e()
    .url()
    .then((url: string) => {
      const id = getDataSourceId(url);

      e2e.getScenarioContext().then(({ addedDataSources }: any) => {
        e2e.setScenarioContext({
          addedDataSources: [...addedDataSources, { id, name } as DeleteDataSourceConfig],
        });
      });

      if (checkHealth) {
        const healthUrl = fromBaseUrl(`/api/datasources/${id}/health`);
        e2e().logToConsole(`Fetching ${healthUrl}`);
        e2e()
          .request(healthUrl)
          .its('body')
          .should('have.property', 'status')
          .and('eq', 'OK');
      }

      // @todo remove `wrap` when possible
      return e2e().wrap({
        config: fullConfig,
        id,
      });
    });
};
