import { Pages } from '../index';

export const deleteDataSource = (pluginName?: string) => {
  pluginName = pluginName || 'TestData DB';

  Pages.DataSources.visit();
  Pages.DataSources.dataSources().each(item => {
    const text = item.text();
    if (pluginName && text && text.indexOf(pluginName) !== -1) {
      item.click();
    }
  });

  Pages.DataSource.delete().click();
};
