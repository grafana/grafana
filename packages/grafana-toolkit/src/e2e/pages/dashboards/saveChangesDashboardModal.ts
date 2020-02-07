import { ClickablePageObjectType, PageObject, Selector } from '../../pageObjects';
import { TestPage } from '../../pageInfo';

export interface SaveChangesDashboardModal {
  save: ClickablePageObjectType;
  success: PageObject;
}

export const saveChangesDashboardModal = new TestPage<SaveChangesDashboardModal>({
  pageObjects: {
    save: 'Dashboard settings Save Dashboard Modal Save button',
    success: () => Selector.fromSelector('.alert-success'),
  },
});
