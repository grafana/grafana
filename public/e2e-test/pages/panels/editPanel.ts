import {
  SelectPageObjectType,
  SelectPageObject,
  Selector,
  ClickablePageObjectType,
  ClickablePageObject,
} from 'e2e-test/core/pageObjects';
import { TestPage } from 'e2e-test/core/pages';

export interface EditPanelPage {
  scenarioSelect: SelectPageObjectType;
  saveDashboard: ClickablePageObjectType;
}

export const editPanelPage = new TestPage<EditPanelPage>({
  pageObjects: {
    scenarioSelect: new SelectPageObject(Selector.fromAriaLabel('Scenario Select')),
    saveDashboard: new ClickablePageObject(Selector.fromAriaLabel('Save dashboard navbar button')),
  },
});
