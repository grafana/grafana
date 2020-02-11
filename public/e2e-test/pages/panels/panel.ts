import { ClickablePageObjectType, TestPage } from '@grafana/toolkit/src/e2e';

export interface Panel {
  panelTitle: ClickablePageObjectType;
  share: ClickablePageObjectType;
}

export const panel = new TestPage<Panel>({
  pageObjects: {
    panelTitle: 'Panel Title',
    share: 'Share panel menu item',
  },
});
