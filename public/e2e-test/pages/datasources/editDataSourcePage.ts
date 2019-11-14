import {
  ClickablePageObject,
  ClickablePageObjectType,
  InputPageObject,
  InputPageObjectType,
  PageObject,
  PageObjectType,
  Selector,
  TestPage,
} from '@grafana/toolkit/src/e2e';

export interface EditDataSourcePage {
  name: InputPageObjectType;
  delete: ClickablePageObjectType;
  saveAndTest: ClickablePageObjectType;
  alert: PageObjectType;
  alertMessage: PageObjectType;
}

export const editDataSourcePage = new TestPage<EditDataSourcePage>({
  pageObjects: {
    name: new InputPageObject(Selector.fromAriaLabel('Datasource settings page name input field')),
    delete: new ClickablePageObject(Selector.fromAriaLabel('Delete button')),
    saveAndTest: new ClickablePageObject(Selector.fromAriaLabel('Save and Test button')),
    alert: new PageObject(Selector.fromAriaLabel('Datasource settings page Alert')),
    alertMessage: new PageObject(Selector.fromAriaLabel('Datasource settings page Alert message')),
  },
});
