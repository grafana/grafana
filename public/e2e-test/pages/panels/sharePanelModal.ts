import { ClickablePageObjectType, TestPage } from '@grafana/toolkit/src/e2e';

export interface SharePanelModal {
  directLinkRenderedImage: ClickablePageObjectType;
}

export const sharePanelModal = new TestPage<SharePanelModal>({
  pageObjects: {
    directLinkRenderedImage: 'Link to rendered image',
  },
});
