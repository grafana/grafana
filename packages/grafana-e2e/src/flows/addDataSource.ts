import { e2e } from '../index';

export const addDataSource = (pluginName?: string): string => {
  pluginName = pluginName || 'TestData DB';
  e2e().logToConsole('Adding data source with pluginName:', pluginName);
  e2e.pages.AddDataSource.visit();
  e2e.pages.AddDataSource.dataSourcePlugins(pluginName)
    .scrollIntoView()
    .should('be.visible') // prevents flakiness
    .click();

  const dataSourceName = `e2e-${new Date().getTime()}`;
  e2e.pages.DataSource.name().clear();
  e2e.pages.DataSource.name().type(dataSourceName);
  e2e.pages.DataSource.saveAndTest().click();
  e2e.pages.DataSource.alert().should('exist');
  e2e.pages.DataSource.alertMessage().should('contain.text', 'Data source is working');
  e2e().logToConsole('Added data source with name:', dataSourceName);
  e2e.context().set('lastAddedDataSource', dataSourceName);

  return dataSourceName;
};
