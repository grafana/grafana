import { ClickablePageObjectType, InputPageObjectType, PageObjectType, TestPage } from '@grafana/toolkit/src/e2e';

export interface EditDataSourcePage {
  name: InputPageObjectType;
  delete: ClickablePageObjectType;
  saveAndTest: ClickablePageObjectType;
  alert: PageObjectType;
  alertMessage: PageObjectType;
}

export const editDataSourcePage = new TestPage<EditDataSourcePage>({
  pageObjects: {
    name: 'Datasource settings page name input field',
    delete: 'Delete button',
    saveAndTest: 'Save and Test button',
    alert: 'Datasource settings page Alert',
    alertMessage: 'Datasource settings page Alert message',
  },
});
