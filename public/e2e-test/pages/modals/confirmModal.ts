import { ClickablePageObject, ClickablePageObjectType, PageObject, Selector, TestPage } from '@grafana/toolkit/src/e2e';

export interface ConfirmModal {
  delete: ClickablePageObjectType;
  success: PageObject;
}

export const confirmModal = new TestPage<ConfirmModal>({
  pageObjects: {
    delete: new ClickablePageObject(Selector.fromAriaLabel('Confirm Modal Danger Button')),
    success: new PageObject(Selector.fromSelector('.alert-success')),
  },
});
