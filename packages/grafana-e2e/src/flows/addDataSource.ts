import { e2e } from '../index';
import { fromBaseUrl, getDataSourceId } from '../support/url';
import { setScenarioContext } from '../support/scenarioContext';

export interface AddDataSourceConfig {
  checkHealth: boolean;
  expectedAlertMessage: string;
  form: Function;
  name: string;
}

const DEFAULT_ADD_DATA_SOURCE_CONFIG: AddDataSourceConfig = {
  checkHealth: false,
  expectedAlertMessage: 'Data source is working',
  form: () => {},
  name: 'TestData DB',
};

export const addDataSource = (config?: Partial<AddDataSourceConfig>): string => {
  const { checkHealth, expectedAlertMessage, form, name } = { ...DEFAULT_ADD_DATA_SOURCE_CONFIG, ...config };

  e2e().logToConsole('Adding data source with name:', name);
  e2e.pages.AddDataSource.visit();
  e2e.pages.AddDataSource.dataSourcePlugins(name)
    .scrollIntoView()
    .should('be.visible') // prevents flakiness
    .click();

  const dataSourceName = `e2e-${Date.now()}`;
  e2e.pages.DataSource.name().clear();
  e2e.pages.DataSource.name().type(dataSourceName);
  form();
  e2e.pages.DataSource.saveAndTest().click();
  e2e.pages.DataSource.alert().should('exist');
  e2e.pages.DataSource.alertMessage().should('contain.text', expectedAlertMessage);
  e2e().logToConsole('Added data source with name:', dataSourceName);

  if (checkHealth) {
    e2e()
      .url()
      .then((url: string) => {
        const dataSourceId = getDataSourceId(url);

        setScenarioContext({
          lastAddedDataSource: dataSourceName,
          lastAddedDataSourceId: dataSourceId,
        });

        const healthUrl = fromBaseUrl(`/api/datasources/${dataSourceId}/health`);
        e2e().logToConsole(`Fetching ${healthUrl}`);
        e2e()
          .request(healthUrl)
          .its('body')
          .should('have.property', 'status')
          .and('eq', 'OK');
      });
  } else {
    setScenarioContext({
      lastAddedDataSource: dataSourceName,
    });
  }

  return dataSourceName;
};
