import { ClickablePageObjectType, InputPageObjectType, PageObject, Selector } from '../../pageObjects';
import { TestPage } from '../../pageInfo';

export interface SaveDashboardModal {
  name: InputPageObjectType;
  save: ClickablePageObjectType;
  success: PageObject;
}

export const saveDashboardModal = new TestPage<SaveDashboardModal>({
  pageObjects: {
    name: 'Save dashboard title field',
    save: 'Save dashboard button',
    success: () => Selector.fromSelector('.alert-success'),
  },
});
