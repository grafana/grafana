import { ClickablePageObjectType, ClickablePageObject, Selector } from 'e2e-test/core/pageObjects';
import { TestPage } from 'e2e-test/core/pages';

export interface Panel {
  panelTitle: ClickablePageObjectType;
  share: ClickablePageObjectType;
}

export const panel = new TestPage<Panel>({
  pageObjects: {
    panelTitle: new ClickablePageObject(Selector.fromAriaLabel('Panel Title')),
    share: new ClickablePageObject(Selector.fromAriaLabel('Share panel menu item')),
  },
});
