import { ClickablePageObjectType, PageObject, Selector } from '../../pageObjects';
import { TestPage } from '../../pageInfo';

export interface ConfirmModal {
  delete: ClickablePageObjectType;
  success: PageObject;
}

export const confirmModal = new TestPage<ConfirmModal>({
  pageObjects: {
    delete: 'Confirm Modal Danger Button',
    success: () => Selector.fromSelector('.alert-success'),
  },
});
