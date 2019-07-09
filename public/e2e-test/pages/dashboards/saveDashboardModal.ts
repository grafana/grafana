import {
  TestPage,
  ClickablePageObjectType,
  ClickablePageObject,
  Selector,
  InputPageObjectType,
  InputPageObject,
} from '@grafana/toolkit';

export interface SaveDashboardModal {
  name: InputPageObjectType;
  save: ClickablePageObjectType;
}

export const saveDashboardModal = new TestPage<SaveDashboardModal>({
  pageObjects: {
    name: new InputPageObject(Selector.fromAriaLabel('Save dashboard title field')),
    save: new ClickablePageObject(Selector.fromAriaLabel('Save dashboard button')),
  },
});
