import { e2e } from '../index';
import { fromBaseUrl } from '../support/url';

export const deleteDataSource = (dataSourceName: string) => {
  e2e().logToConsole('Deleting data source with name:', dataSourceName);
  e2e().request('DELETE', fromBaseUrl(`/api/datasources/name/${dataSourceName}`));

  /* https://github.com/cypress-io/cypress/issues/2831
  Pages.DataSources.visit();
  Pages.DataSources.dataSources(dataSourceName).click();

  Pages.DataSource.delete().click();

  Pages.ConfirmModal.delete().click();

  Pages.DataSources.visit();
  Pages.DataSources.dataSources().each(item => {
    const text = item.text();
    if (text && text.indexOf(dataSourceName) !== -1) {
      expect(false).equals(true, `Data source ${dataSourceName} was found although it was deleted.`);
    }
  });
 */
};
