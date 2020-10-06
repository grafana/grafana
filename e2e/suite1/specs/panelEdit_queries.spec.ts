import { e2e } from '@grafana/e2e';
import { expect } from '../../../public/test/lib/common';

const PANEL_UNDER_TEST = 'Random walk series';

e2e.scenario({
  describeName: 'Panel edit tests - queries',
  itName: 'Testes various Panel edit queries scenarios',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: '5SdHCadmz' });

    e2e.flows.openPanelMenuItem(e2e.flows.PanelMenuItems.Edit, PANEL_UNDER_TEST);

    // New panel editor opens when navigating from Panel menu
    e2e.components.PanelEditor.General.content().should('be.visible');

    // Queries tab is rendered and open by default
    e2e.components.PanelEditor.DataPane.content().should('be.visible');

    // We expect row with refId A to exist and be visible
    e2e.components.QueryEditorRows.rows().within(rows => {
      expect(rows.length).equals(1);
    });

    e2e().server();
    e2e()
      .route({
        method: 'POST',
        url: '/api/tsdb/query',
      })
      .as('apiPostQuery');

    // Add query button should be visible and clicking on it should create a new row
    e2e.components.QueryTab.addQuery()
      .scrollIntoView()
      .should('be.visible')
      .click();

    // We expect row with refId A and B to exist and be visible
    e2e.components.QueryEditorRows.rows().within(rows => {
      expect(rows.length).equals(2);
    });

    // Remove refId A
    e2e.components.QueryEditorRow.actionButton('Remove query')
      .eq(0)
      .should('be.visible')
      .click();

    e2e().wait('@apiPostQuery');

    // We expect row with refId B to exist and be visible
    e2e.components.QueryEditorRows.rows().within(rows => {
      expect(rows.length).equals(1);
    });

    // Duplicate refId B
    e2e.components.QueryEditorRow.actionButton('Duplicate query')
      .eq(0)
      .should('be.visible')
      .click();

    // We expect row with refId Band and A to exist and be visible
    e2e.components.QueryEditorRows.rows().within(rows => {
      expect(rows.length).equals(2);
    });

    // Change to CSV Metric Values scenario for A
    e2e.components.DataSource.TestData.QueryTab.scenarioSelect()
      .eq(1)
      .select('CSV Metric Values');

    e2e().wait('@apiPostQuery');

    // Disable / enable row
    expectInspectorResultAndClose(keys => {
      const length = keys.length;
      expect(keys[length - 2].innerText).equals('A:');
      expect(keys[length - 1].innerText).equals('B:');
    });

    // Disable row with refId A
    e2e.components.QueryEditorRow.actionButton('Disable/enable query')
      .eq(1)
      .should('be.visible')
      .click();

    e2e().wait('@apiPostQuery');

    expectInspectorResultAndClose(keys => {
      const length = keys.length;
      expect(keys[length - 1].innerText).equals('B:');
    });

    // Enable row with refId B
    e2e.components.QueryEditorRow.actionButton('Disable/enable query')
      .eq(1)
      .should('be.visible')
      .click();

    e2e().wait('@apiPostQuery');

    expectInspectorResultAndClose(keys => {
      const length = keys.length;
      expect(keys[length - 2].innerText).equals('A:');
      expect(keys[length - 1].innerText).equals('B:');
    });
  },
});

const expectInspectorResultAndClose = (expectCallBack: (keys: any[]) => void) => {
  e2e.components.QueryTab.queryInspectorButton()
    .should('be.visible')
    .click();

  e2e.components.PanelInspector.Query.refreshButton()
    .should('be.visible')
    .click();

  e2e().wait('@apiPostQuery');

  e2e.components.PanelInspector.Query.jsonObjectKeys()
    .should('be.visible')
    .within((keys: any) => expectCallBack(keys));

  e2e.components.Drawer.General.close()
    .should('be.visible')
    .click();
};
