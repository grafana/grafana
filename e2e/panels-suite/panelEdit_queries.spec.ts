import { e2e } from '@grafana/e2e';

const flakyTimeout = 10000;

e2e.scenario({
  describeName: 'Panel edit tests - queries',
  itName: 'Testes various Panel edit queries scenarios',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: '5SdHCadmz', queryParams: { editPanel: 3 } });

    // New panel editor opens when navigating from Panel menu
    e2e.components.PanelEditor.General.content().should('be.visible');

    // Queries tab is rendered and open by default
    e2e.components.PanelEditor.DataPane.content().should('be.visible');

    // We expect row with refId A to exist and be visible
    e2e.components.QueryEditorRows.rows().within((rows) => {
      expect(rows.length).equals(1);
    });

    // Add query button should be visible and clicking on it should create a new row
    e2e.components.QueryTab.addQuery().scrollIntoView().should('be.visible').click();

    // We expect row with refId A and B to exist and be visible
    e2e.components.QueryEditorRows.rows({ timeout: flakyTimeout }).should('have.length', 2);

    // Remove refId A
    e2e.components.QueryEditorRow.actionButton('Remove query').eq(0).scrollIntoView();
    e2e.components.QueryEditorRow.actionButton('Remove query').eq(0).should('be.visible').click();

    // We expect row with refId B to exist and be visible
    e2e.components.QueryEditorRows.rows({ timeout: flakyTimeout }).should('have.length', 1);

    // Duplicate refId B
    e2e.components.QueryEditorRow.actionButton('Duplicate query').eq(0).should('be.visible').click();

    // We expect row with refId Band and A to exist and be visible
    e2e.components.QueryEditorRows.rows().within((rows) => {
      expect(rows.length).equals(2);
    });

    // Change to CSV Metric Values scenario for A
    e2e.components.DataSource.TestData.QueryTab.scenarioSelectContainer()
      .should('be.visible')
      .within(() => {
        e2e().get('input[id*="test-data-scenario-select-"]').eq(0).should('be.visible').click();
      });

    cy.contains('CSV Metric Values').scrollIntoView().should('be.visible').eq(0).click();

    // Disable / enable row
    expectInspectorResultAndClose((keys) => {
      const length = keys.length;
      const resultIds = new Set<string>([
        keys[length - 2].innerText, // last 2
        keys[length - 1].innerText, // last 2
      ]);

      expect(resultIds.has('A:')).equals(true);
      expect(resultIds.has('B:')).equals(true);
    });

    // Disable row with refId A
    e2e.components.QueryEditorRow.actionButton('Disable/enable query').eq(1).should('be.visible').click();

    expectInspectorResultAndClose((keys) => {
      const length = keys.length;
      expect(keys[length - 1].innerText).equals('B:');
    });

    // Enable row with refId B
    e2e.components.QueryEditorRow.actionButton('Disable/enable query').eq(1).should('be.visible').click();

    expectInspectorResultAndClose((keys) => {
      const length = keys.length;
      const resultIds = new Set<string>([
        keys[length - 2].innerText, // last 2
        keys[length - 1].innerText, // last 2
      ]);

      expect(resultIds.has('A:')).equals(true);
      expect(resultIds.has('B:')).equals(true);
    });
  },
});

const expectInspectorResultAndClose = (expectCallBack: (keys: JQuery<HTMLElement>) => void) => {
  e2e.components.QueryTab.queryInspectorButton().should('be.visible').click();

  e2e.components.PanelInspector.Query.refreshButton().should('be.visible').click();

  e2e.components.PanelInspector.Query.jsonObjectKeys({ timeout: flakyTimeout })
    .should('be.visible')
    .within((keys) => expectCallBack(keys));

  e2e.components.Drawer.General.close().should('be.visible').click();
};
