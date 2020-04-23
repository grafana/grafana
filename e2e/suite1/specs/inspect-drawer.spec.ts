import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Inspect drawer tests',
  itName: 'Testes various Inpect Drawer scenarios',
  addScenarioDataSource: false,
  addScenarioDashBoard: true,
  skipScenario: false,
  scenario: () => {
    const viewPortWidth = e2e.config().viewportWidth;
    // @todo remove `@ts-ignore` when possible
    // @ts-ignore
    e2e.getScenarioContext().then(({ lastAddedDashboardUid }) => {
      e2e.flows.openDashboard(lastAddedDashboardUid);
    });
    e2e.pages.Dashboard.Toolbar.toolbarItems('Add panel').click();
    e2e.pages.AddDashboard.addNewPanel().click();

    e2e.components.DataSource.TestData.QueryTab.scenarioSelect().select('CSV Metric Values');

    e2e.components.BackButton.backArrow().click();

    // testing opening inspect drawer directly by clicking on Inspect in header menu
    e2e.flows.openPanelMenuItem(e2e.flows.PanelMenuItems.Inspect);

    expectDrawerTabsAndContent();

    expectDrawerExpandAndContract(viewPortWidth);

    expectDrawerClose();

    expectSubMenuScenario('Data');
    expectSubMenuScenario('Query');
    expectSubMenuScenario('Panel JSON', 'JSON');

    e2e.flows.openPanelMenuItem(e2e.flows.PanelMenuItems.Edit);

    e2e.components.QueryEditorToolbarItem.button('Query inspector')
      .should('be.visible')
      .click();

    e2e.components.Drawer.General.title('Panel Title')
      .should('be.visible')
      .within(() => {
        e2e.components.Tab.title('Query').should('be.visible');
        // query should be the active tab
        e2e.components.Tab.active().should('have.text', 'Query');
      });

    e2e.components.PanelInspectQuery.content().should('be.visible');
  },
});

const expectDrawerTabsAndContent = () => {
  e2e.components.Drawer.General.title('Panel Title')
    .should('be.visible')
    .within(() => {
      e2e.components.Tab.title('Data').should('be.visible');
      // data should be the active tab
      e2e.components.Tab.active().within((li: JQuery<HTMLLIElement>) => {
        expect(li.text()).equals('Data');
      });
      e2e.components.PanelInspectData.content().should('be.visible');
      e2e.components.PanelInspectStats.content().should('not.be.visible');
      e2e.components.PanelInspectJSON.content().should('not.be.visible');
      e2e.components.PanelInspectQuery.content().should('not.be.visible');

      // other tabs should also be visible, click on each to see if we get any console errors
      e2e.components.Tab.title('Stats')
        .should('be.visible')
        .click();
      e2e.components.PanelInspectStats.content().should('be.visible');
      e2e.components.PanelInspectData.content().should('not.be.visible');
      e2e.components.PanelInspectJSON.content().should('not.be.visible');
      e2e.components.PanelInspectQuery.content().should('not.be.visible');

      e2e.components.Tab.title('JSON')
        .should('be.visible')
        .click();
      e2e.components.PanelInspectJSON.content().should('be.visible');
      e2e.components.PanelInspectData.content().should('not.be.visible');
      e2e.components.PanelInspectStats.content().should('not.be.visible');
      e2e.components.PanelInspectQuery.content().should('not.be.visible');

      e2e.components.Tab.title('Query')
        .should('be.visible')
        .click();
      e2e.components.PanelInspectQuery.content().should('be.visible');
      e2e.components.PanelInspectData.content().should('not.be.visible');
      e2e.components.PanelInspectStats.content().should('not.be.visible');
      e2e.components.PanelInspectJSON.content().should('not.be.visible');
    });
};

const expectDrawerClose = () => {
  // close using close button
  e2e.components.Drawer.General.close().click();
  e2e.components.Drawer.General.title('Panel Title').should('not.be.visible');
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
  e2e.components.Panels.Panel.title('Panel Title')
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
