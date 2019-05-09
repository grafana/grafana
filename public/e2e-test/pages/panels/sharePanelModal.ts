import { ClickablePageObjectType, ClickablePageObject, Selector } from 'e2e-test/core/pageObjects';
import { TestPage } from 'e2e-test/core/pages';

export interface SharePanelModal {
  directLinkRenderedImage: ClickablePageObjectType;
}

export const sharePanelModal = new TestPage<SharePanelModal>({
  pageObjects: {
    directLinkRenderedImage: new ClickablePageObject(Selector.fromAriaLabel('Link to rendered image')),
  },
});
