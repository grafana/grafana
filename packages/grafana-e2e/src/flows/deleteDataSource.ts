import { Url } from '../support/url';

export const deleteDataSource = (dataSourceName: string) => {
  cy.request('DELETE', Url.fromBaseUrl(`/api/datasources/name/${dataSourceName}`));

  /* https://github.com/cypress-io/cypress/issues/2831
  Pages.DataSources.visit();
  Pages.DataSources.dataSources().each(item => {
    const text = item.text();
    Cypress.log({ message: [text] });
    if (text && text.indexOf(dataSourceName) !== -1) {
      item.click();
    }
  });

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
