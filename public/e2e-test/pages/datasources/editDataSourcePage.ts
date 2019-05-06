import {
  ClickablePageObjectType,
  PageObjectType,
  ClickablePageObject,
  PageObject,
  Selector,
} from 'e2e-test/core/pageObjects';
import { TestPage } from 'e2e-test/core/pages';

export interface EditDataSourcePage {
  saveAndTest: ClickablePageObjectType;
  alert: PageObjectType;
  alertMessage: PageObjectType;
}

export const editDataSourcePage = new TestPage<EditDataSourcePage>({
  pageObjects: {
    saveAndTest: new ClickablePageObject(Selector.fromAriaLabel('save and test button')),
    alert: new PageObject(Selector.fromAriaLabel('alert')),
    alertMessage: new PageObject(Selector.fromAriaLabel('alert message')),
  },
});
