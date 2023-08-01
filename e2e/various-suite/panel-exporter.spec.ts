import { e2e } from '@grafana/e2e';

const PANEL_UNDER_TEST = 'Value reducers 1';

Cypress.config('defaultCommandTimeout', 60000);

e2e.scenario({
  // using inspect-drawer.spec.ts as a basis to write these tests
  describeName: 'Export Panel tests',
  itName: 'Tests all file formats are succesfully downloaded', // particularly image files need to be tested I think
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    cy.clock(0, ['Date']).then((clock) => {
      // @ts-ignore some typing issue
      e2e().on('uncaught:exception', (err) => {
        if (err.stack?.indexOf("TypeError: Cannot read property 'getText' of null") !== -1) {
          return false;
        }
        return true;
      });

      e2e.flows.openDashboard({ uid: 'wfTJJL5Wz' });

      e2e.flows.openPanelMenuItem(e2e.flows.PanelMenuItems.Export, PANEL_UNDER_TEST);

      expectSubMenuScenario('Image', 'PNG', '.png');
      expectSubMenuScenario('Image', 'JPEG', '.jpeg');
      expectSubMenuScenario('Image', 'BMP', '.bmp');

      expectSubMenuScenario('Data', 'CSV', '.csv');
      expectSubMenuScenario('Data', 'Excel', '.xlsx');
      expectSubMenuScenario('Data', 'Data JSON', '.json');
      expectSubMenuScenario('Data', 'DataFrame JSON', '.json');
      expectSubMenuScenario('Data', 'Panel JSON', '.json');
    });
  },
});

const expectSubMenuScenario = (subMenu: string, menuItem: string, extension: string) => {
  // testing opening inspect drawer from sub menus under Inspect in header menu
  e2e.components.Panels.Panel.title(PANEL_UNDER_TEST).scrollIntoView().should('be.visible').click();
  e2e.components.Panels.Panel.menu(PANEL_UNDER_TEST).click({ force: true });

  // simulate hover on Export menu item to display sub menus
  e2e.components.Panels.Panel.menuItems('Export').trigger('mouseover', { force: true });
  e2e.components.Panels.Panel.menuItems(subMenu).trigger('mouseover', { force: true });
  e2e.components.Panels.Panel.menuItems(menuItem).click({ force: true });

  // https://www.browserstack.com/docs/automate/cypress/file-download-testing
  if (Cypress.browser.isHeaded) {
    cy.readFile(`cypress/downloads/${PANEL_UNDER_TEST}-1970-01-01 01_00_00${extension}`);
  }
};
