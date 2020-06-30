import { e2e } from '@grafana/e2e';

const DASHBOARD = 'O6f11TZWk';
const PANEL = 'Title above bar';

e2e.scenario({
  describeName: 'Panel Inspect data tab',
  itName: 'Test combinations of transformations in the Panel inspect data tab',
  scenario: () => {
    e2e.flows.openDashboard({ uid: DASHBOARD });

    // Apply try transforms
    e2e.flows.openPanelMenuItem(e2e.flows.PanelMenuItems.Edit, PANEL);

    //Navigate to transforms
    e2e.components.Tab.title('Transform')
      .should('be.visible')
      .click();
    // Select outer join
    e2e.components.TransformTab.newTransform('Outer join')
      .scrollIntoView()
      .should('be.visible')
      .click();

    // e2e.flows.openPanelMenuItem(e2e.flows.PanelMenuItems.Inspect, PANEL);

    e2e.components.Panels.Panel.title(PANEL)
      .should('be.visible')
      .eq(1)
      .click();

    e2e.components.Panels.Panel.headerItems(e2e.flows.PanelMenuItems.Inspect)
      .should('be.visible')
      .click();

    e2e.components.PanelInspector.Data.content()
      .should('be.visible')
      .within(() => {
        e2e.components.QueryOperationRow.title()
          .should('be.visible')
          .click();
        e2e.components.Select.input()
          .should('be.visible')
          .click();
        e2e.components.Select.option()
          .should('be.visible')
          .eq(2)
          .click();
        e2e.components.PanelInspector.Data.applyTransforms().click();

        // Only two options should be vailable: Series and the transform data frame
        e2e.components.Select.option().should('have.length', 4);
      });
  },
});
