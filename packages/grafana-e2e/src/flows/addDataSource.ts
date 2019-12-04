import { Pages } from '../index';

export const addDataSource = (pluginName?: string): string => {
  pluginName = pluginName || 'TestData DB';

  Pages.DataSources.visit();
  Pages.DataSources.addDataSource().click();

  Pages.AddDataSource.dataSourcePlugin().each(item => {
    const text = item.text();
    if (pluginName && text && text.indexOf(pluginName) !== -1) {
      item.click();
    }
  });

  const dataSourceName = `e2e-${new Date().getTime()}`;
  Pages.DataSource.name().clear();
  Pages.DataSource.name().type(dataSourceName);
  Pages.DataSource.saveAndTest().click();
  Pages.DataSource.alert().should('exist');
  Pages.DataSource.alertMessage().should('contain.text', 'Data source is working');

  return dataSourceName;
};
