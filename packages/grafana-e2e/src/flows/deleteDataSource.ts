import { e2e } from '../index';
import { fromBaseUrl } from '../support/url';

export interface DeleteDataSourceConfig {
  id: string;
  name: string;
  quick?: boolean;
}

export const deleteDataSource = ({ id, name, quick = false }: DeleteDataSourceConfig) => {
  e2e().logToConsole('Deleting data source with name:', name);

  if (quick) {
    quickDelete(name);
  } else {
    uiDelete(name);
  }

  e2e().logToConsole('Deleted data source with name:', name);

  e2e.getScenarioContext().then(({ addedDataSources }: any) => {
    e2e.setScenarioContext({
      addedDataSources: addedDataSources.filter((dataSource: DeleteDataSourceConfig) => {
        return dataSource.id !== id && dataSource.name !== name;
      }),
    });
  });
};

const quickDelete = (name: string) => {
  e2e().request('DELETE', fromBaseUrl(`/api/datasources/name/${name}`));
};

const uiDelete = (name: string) => {
  e2e.pages.DataSources.visit();
  e2e.pages.DataSources.dataSources(name).click();
  e2e.pages.DataSource.delete().click();
  e2e.pages.ConfirmModal.delete().click();

  e2e.pages.DataSources.visit();

  // @todo replace `e2e.pages.DataSources.dataSources` with this when argument is empty
  e2e()
    .get('[aria-label^="Data source list item "]')
    .each(item =>
      e2e()
        .wrap(item)
        .should('not.contain', name)
    );
};
