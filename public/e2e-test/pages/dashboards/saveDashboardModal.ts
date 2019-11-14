import {
  TestPage,
  ClickablePageObjectType,
  ClickablePageObject,
  Selector,
  InputPageObjectType,
  InputPageObject,
  PageObject,
} from '@grafana/toolkit/src/e2e';

export interface SaveDashboardModal {
  name: InputPageObjectType;
  save: ClickablePageObjectType;
  success: PageObject;
}

export const saveDashboardModal = new TestPage<SaveDashboardModal>({
  pageObjects: {
    name: new InputPageObject(Selector.fromAriaLabel('Save dashboard title field')),
    save: new ClickablePageObject(Selector.fromAriaLabel('Save dashboard button')),
    success: new PageObject(Selector.fromSelector('.alert-success')),
  },
});
