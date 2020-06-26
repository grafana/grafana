import { e2e } from '@grafana/e2e';

const PANEL_UNDER_TEST = '2 yaxis and axis labels';

e2e.scenario({
  describeName: 'Inspect drawer tests',
  itName: 'Tests various Inspect Drawer scenarios',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    const viewPortWidth = e2e.config().viewportWidth;
    e2e.flows.openDashboard({ uid: '5SdHCadmz' });

    // testing opening inspect drawer directly by clicking on Inspect in header menu
    e2e.flows.openPanelMenuItem(e2e.flows.PanelMenuItems.Inspect, PANEL_UNDER_TEST);

    expectDrawerTabsAndContent();

    expectDrawerExpandAndContract(viewPortWidth);

    expectDrawerClose();

    expectSubMenuScenario('Data');
    expectSubMenuScenario('Query');
    expectSubMenuScenario('Panel JSON', 'JSON');

    e2e.flows.openPanelMenuItem(e2e.flows.PanelMenuItems.Edit, PANEL_UNDER_TEST);

    e2e.components.QueryTab.queryInspectorButton()
      .should('be.visible')
      .click();

    e2e.components.Drawer.General.title(`Inspect: ${PANEL_UNDER_TEST}`)
      .should('be.visible')
      .within(() => {
        e2e.components.Tab.title('Query').should('be.visible');
        // query should be the active tab
        e2e.components.Tab.active().should('have.text', 'Query');
      });

    e2e.components.PanelInspector.Query.content().should('be.visible');
  },
});

const expectDrawerTabsAndContent = () => {
  e2e.components.Drawer.General.title(`Inspect: ${PANEL_UNDER_TEST}`)
    .should('be.visible')
    .within(() => {
      e2e.components.Tab.title('Data').should('be.visible');
      // data should be the active tab
      e2e.components.Tab.active().within((li: JQuery<HTMLLIElement>) => {
        expect(li.text()).equals('Data');
      });
      e2e.components.PanelInspector.Data.content().should('be.visible');
      e2e.components.PanelInspector.Stats.content().should('not.be.visible');
      e2e.components.PanelInspector.Json.content().should('not.be.visible');
      e2e.components.PanelInspector.Query.content().should('not.be.visible');

      // other tabs should also be visible, click on each to see if we get any console errors
      e2e.components.Tab.title('Stats')
        .should('be.visible')
        .click();
      e2e.components.PanelInspector.Stats.content().should('be.visible');
      e2e.components.PanelInspector.Data.content().should('not.be.visible');
      e2e.components.PanelInspector.Json.content().should('not.be.visible');
      e2e.components.PanelInspector.Query.content().should('not.be.visible');

      e2e.components.Tab.title('JSON')
        .should('be.visible')
        .click();
      e2e.components.PanelInspector.Json.content().should('be.visible');
      e2e.components.PanelInspector.Data.content().should('not.be.visible');
      e2e.components.PanelInspector.Stats.content().should('not.be.visible');
      e2e.components.PanelInspector.Query.content().should('not.be.visible');

      e2e.components.Tab.title('Query')
        .should('be.visible')
        .click();
      e2e.components.PanelInspector.Query.content().should('be.visible');
      e2e.components.PanelInspector.Data.content().should('not.be.visible');
      e2e.components.PanelInspector.Stats.content().should('not.be.visible');
      e2e.components.PanelInspector.Json.content().should('not.be.visible');
    });
};

const expectDrawerClose = () => {
  // close using close button
  e2e.components.Drawer.General.close().click();
  e2e.components.Drawer.General.title(`Inspect: ${PANEL_UNDER_TEST}`).should('not.be.visible');
};

const expectDrawerExpandAndContract = (viewPortWidth: number) => {
  // try expand button
  // drawer should take up half the screen
  e2e.components.Drawer.General.rcContentWrapper()
    .should('be.visible')
    .should('have.css', 'width', `${viewPortWidth / 2}px`);

  e2e.components.Drawer.General.expand().click();
  e2e.components.Drawer.General.contract().should('be.visible');

  // drawer should take up the whole screen
  e2e.components.Drawer.General.rcContentWrapper()
    .should('be.visible')
    .should('have.css', 'width', `${viewPortWidth}px`);

  // try contract button
  e2e.components.Drawer.General.contract().click();
  e2e.components.Drawer.General.expand().should('be.visible');

  e2e.components.Drawer.General.rcContentWrapper()
    .should('be.visible')
    .should('have.css', 'width', `${viewPortWidth / 2}px`);
};

const expectSubMenuScenario = (subMenu: string, tabTitle?: string) => {
  tabTitle = tabTitle ?? subMenu;
  // testing opening inspect drawer from sub menus under Inspect in header menu
  e2e.components.Panels.Panel.title(PANEL_UNDER_TEST)
    .scrollIntoView()
    .should('be.visible')
    .click();

  // sub menus are in the DOM but not visible and because there is no hover support in Cypress force click
  // https://github.com/cypress-io/cypress-example-recipes/blob/master/examples/testing-dom__hover-hidden-elements/cypress/integration/hover-hidden-elements-spec.js
  e2e.components.Panels.Panel.headerItems(subMenu).click({ force: true });

  // data should be the default tab
  e2e.components.Tab.title(tabTitle).should('be.visible');
  e2e.components.Tab.active().should('have.text', tabTitle);

  expectDrawerClose();
};
