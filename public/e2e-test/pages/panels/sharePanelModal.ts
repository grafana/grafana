import { TestPage, ClickablePageObjectType, ClickablePageObject, Selector } from '@grafana/toolkit/src/e2e';

export interface SharePanelModal {
  directLinkRenderedImage: ClickablePageObjectType;
}

export const sharePanelModal = new TestPage<SharePanelModal>({
  pageObjects: {
    directLinkRenderedImage: new ClickablePageObject(Selector.fromAriaLabel('Link to rendered image')),
  },
});
