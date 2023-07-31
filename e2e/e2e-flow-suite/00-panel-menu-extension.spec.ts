import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Panel menu ui extension flow',
  itName: 'Should be possible to click extension menu item',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    const panelTitle = 'Random walk series';
    const extensionTitle = 'Copy';

    e2e.flows.openDashboard({ uid: '5SdHCasdf' });
    e2e.flows.openPanelMenuExtension(extensionTitle, panelTitle);
    e2e.flows.assertSuccessNotification();
  },
});
