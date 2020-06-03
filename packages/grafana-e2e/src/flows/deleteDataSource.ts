import { e2e } from '../index';
import { fromBaseUrl } from '../support/url';

export interface DeleteDataSourceConfig {
  id: string;
  name: string;
}

export const deleteDataSource = ({ id, name }: DeleteDataSourceConfig) => {
  e2e().logToConsole('Deleting data source with name:', name);
  e2e().request('DELETE', fromBaseUrl(`/api/datasources/name/${name}`));

  /* https://github.com/cypress-io/cypress/issues/2831
  Pages.DataSources.visit();
  Pages.DataSources.dataSources(name).click();

  Pages.DataSource.delete().click();

  Pages.ConfirmModal.delete().click();

  Pages.DataSources.visit();
  Pages.DataSources.dataSources().each(item => {
    const text = item.text();
    if (text && text.indexOf(name) !== -1) {
      expect(false).equals(true, `Data source ${name} was found although it was deleted.`);
    }
  });
  */

  e2e.getScenarioContext().then(({ addedDataSources }: any) => {
    e2e.setScenarioContext({
      addedDataSources: addedDataSources.filter((dataSource: DeleteDataSourceConfig) => {
        return dataSource.id !== id && dataSource.name !== name;
      }),
    });
  });
};
