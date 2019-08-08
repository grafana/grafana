import {
  TestPage,
  ClickablePageObjectType,
  PageObjectType,
  ClickablePageObject,
  PageObject,
  Selector,
} from '@grafana/toolkit';

export interface EditDataSourcePage {
  saveAndTest: ClickablePageObjectType;
  alert: PageObjectType;
  alertMessage: PageObjectType;
}

export const editDataSourcePage = new TestPage<EditDataSourcePage>({
  pageObjects: {
    saveAndTest: new ClickablePageObject(Selector.fromAriaLabel('Save and Test button')),
    alert: new PageObject(Selector.fromAriaLabel('Datasource settings page Alert')),
    alertMessage: new PageObject(Selector.fromAriaLabel('Datasource settings page Alert message')),
  },
});
