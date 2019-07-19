import { TestPage, ClickablePageObjectType, ClickablePageObject, Selector } from '@grafana/toolkit';

export interface SharePanelModal {
  directLinkRenderedImage: ClickablePageObjectType;
}

export const sharePanelModal = new TestPage<SharePanelModal>({
  pageObjects: {
    directLinkRenderedImage: new ClickablePageObject(Selector.fromAriaLabel('Link to rendered image')),
  },
});
