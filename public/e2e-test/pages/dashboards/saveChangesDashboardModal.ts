import { ClickablePageObjectType, PageObject, Selector, TestPage } from '@grafana/toolkit/src/e2e';

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
