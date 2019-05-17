import {
  ClickablePageObjectType,
  ClickablePageObject,
  Selector,
  InputPageObjectType,
  InputPageObject,
} from 'e2e-test/core/pageObjects';
import { TestPage } from 'e2e-test/core/pages';

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
