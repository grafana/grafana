import { ClickablePageObjectType, PageObject, Selector, TestPage } from '@grafana/toolkit/src/e2e';

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
