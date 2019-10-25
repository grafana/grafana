import { TestPage, ClickablePageObjectType, ClickablePageObject, Selector } from '@grafana/toolkit/src/e2e';

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
