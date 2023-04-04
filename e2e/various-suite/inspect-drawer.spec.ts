import { e2e } from '@grafana/e2e';

const PANEL_UNDER_TEST = 'Value reducers 1';

e2e.scenario({
  describeName: 'Inspect drawer tests',
  itName: 'Tests various Inspect Drawer scenarios',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    // @ts-ignore some typing issue
    e2e().on('uncaught:exception', (err) => {
      if (err.stack?.indexOf("TypeError: Cannot read property 'getText' of null") !== -1) {
        // On occasion monaco editor will not have the time to be properly unloaded when we change the tab
        // and then the e2e test fails with the uncaught:exception:
        // TypeError: Cannot read property 'getText' of null
        //     at Object.ai [as getFoldingRanges] (http://localhost:3001/public/build/monaco-json.worker.js:2:215257)
        //     at e.getFoldingRanges (http://localhost:3001/public/build/monaco-json.worker.js:2:221188)
        //     at e.fmr (http://localhost:3001/public/build/monaco-json.worker.js:2:116605)
        //     at e._handleMessage (http://localhost:3001/public/build/monaco-json.worker.js:2:7414)
        //     at Object.handleMessage (http://localhost:3001/public/build/monaco-json.worker.js:2:7018)
        //     at e._handleMessage (http://localhost:3001/public/build/monaco-json.worker.js:2:5038)
        //     at e.handleMessage (http://localhost:3001/public/build/monaco-json.worker.js:2:4606)
        //     at e.onmessage (http://localhost:3001/public/build/monaco-json.worker.js:2:7097)
        //     at Tt.self.onmessage (http://localhost:3001/public/build/monaco-json.worker.js:2:117109)

        // return false to prevent the error from
        // failing this test
        return false;
      }

      return true;
    });

    const viewPortWidth = e2e.config().viewportWidth;
    e2e.flows.openDashboard({ uid: 'wfTJJL5Wz' });

    // testing opening inspect drawer directly by clicking on Inspect in header menu
    e2e.flows.openPanelMenuItem(e2e.flows.PanelMenuItems.Inspect, PANEL_UNDER_TEST, true);

    expectDrawerTabsAndContent();

    expectDrawerExpandAndContract(viewPortWidth);

    expectDrawerClose();

    expectSubMenuScenario('Data');
    expectSubMenuScenario('Query');
    expectSubMenuScenario('Panel JSON', 'JSON');

    e2e.flows.openPanelMenuItem(e2e.flows.PanelMenuItems.Edit, PANEL_UNDER_TEST, true);

    e2e.components.QueryTab.queryInspectorButton().should('be.visible').click();

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
      e2e.components.PanelInspector.Stats.content().should('not.exist');
      e2e.components.PanelInspector.Json.content().should('not.exist');
      e2e.components.PanelInspector.Query.content().should('not.exist');

      // other tabs should also be visible, click on each to see if we get any console errors
      e2e.components.Tab.title('Stats').should('be.visible').click();
      e2e.components.PanelInspector.Stats.content().should('be.visible');
      e2e.components.PanelInspector.Data.content().should('not.exist');
      e2e.components.PanelInspector.Json.content().should('not.exist');
      e2e.components.PanelInspector.Query.content().should('not.exist');

      e2e.components.Tab.title('JSON').should('be.visible').click();
      e2e.components.PanelInspector.Json.content().should('be.visible');
      e2e.components.PanelInspector.Data.content().should('not.exist');
      e2e.components.PanelInspector.Stats.content().should('not.exist');
      e2e.components.PanelInspector.Query.content().should('not.exist');

      e2e.components.Tab.title('Query').should('be.visible').click();

      e2e.components.PanelInspector.Query.content().should('be.visible');
      e2e.components.PanelInspector.Data.content().should('not.exist');
      e2e.components.PanelInspector.Stats.content().should('not.exist');
      e2e.components.PanelInspector.Json.content().should('not.exist');
    });
};

const expectDrawerClose = () => {
  // close using close button
  e2e.components.Drawer.General.close().click();
  e2e.components.Drawer.General.title(`Inspect: ${PANEL_UNDER_TEST}`).should('not.exist');
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
  e2e.components.Panels.Panel.title(PANEL_UNDER_TEST).scrollIntoView().should('be.visible').click();
  e2e.components.Panels.Panel.menu(PANEL_UNDER_TEST).click({ force: true }); // force click because menu is hidden and show on hover
  // sub menus are in the DOM but not visible and because there is no hover support in Cypress force click
  // https://github.com/cypress-io/cypress-example-recipes/blob/master/examples/testing-dom__hover-hidden-elements/cypress/integration/hover-hidden-elements-spec.js

  // simulate hover on Inspector menu item to display sub menus
  e2e.components.Panels.Panel.menuItems('Inspect').trigger('mouseover', { force: true });
  e2e.components.Panels.Panel.menuItems(subMenu).click({ force: true });

  // data should be the default tab
  e2e.components.Tab.title(tabTitle).should('be.visible');
  e2e.components.Tab.active().should('have.text', tabTitle);

  expectDrawerClose();
};
