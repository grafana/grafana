import { Pages } from '../index';

export const deleteDataSource = (dataSourceName: string) => {
  Pages.DataSources.visit();
  Pages.DataSources.dataSources().each(item => {
    const text = item.text();
    if (text && text.indexOf(dataSourceName) !== -1) {
      item.click();
    }
  });

  Pages.DataSource.delete().click();

  Pages.ConfirmModal.delete().click();
};
