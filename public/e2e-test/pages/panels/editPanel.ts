import { ClickablePageObjectType, Selector, SelectPageObjectType, TestPage } from '@grafana/toolkit/src/e2e';

export interface EditPanelPage {
  queriesTab: ClickablePageObjectType;
  saveDashboard: ClickablePageObjectType;
  scenarioSelect: SelectPageObjectType;
  showXAxis: ClickablePageObjectType;
  visualizationTab: ClickablePageObjectType;
}

export const editPanelPage = new TestPage<EditPanelPage>({
  pageObjects: {
    queriesTab: 'Queries tab button',
    saveDashboard: 'Save dashboard navbar button',
    scenarioSelect: 'Scenario Select',
    showXAxis: () => Selector.fromSelector('[aria-label="X-Axis section"] [label=Show] .gf-form-switch'),
    visualizationTab: 'Visualization tab button',
  },
});
