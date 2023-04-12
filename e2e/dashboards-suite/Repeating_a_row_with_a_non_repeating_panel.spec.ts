import { e2e } from '@grafana/e2e';
const PAGE_UNDER_TEST = 'k3PEoCpnk/repeating-a-row-with-a-non-repeating-panel-and-horizontal-repeating-panel';
const DASHBOARD_NAME = 'Repeating a row with a non-repeating panel and horizontal repeating panel';

describe('Repeating a row with repeated panels and a non-repeating panel', () => {
  beforeEach(() => {
    e2e.flows.login('admin', 'admin');
  });

  it('should be able to collapse and expand a repeated row without losing panels', () => {
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });
    e2e().contains(DASHBOARD_NAME).should('be.visible');

    const panelsToCheck = [
      'Row 2 non-repeating panel',
      'Row 2 repeating panel 1',
      'Row 2 repeating panel 2',
      'Row 2 repeating panel 3',
    ];

    // Collapse Row 1 first so the Row 2 panels all fit on the screen
    e2e.components.DashboardRow.title('Row 1').click();

    // Rows are expanded by default, so check that all panels are visible
    panelsToCheck.forEach((title) => {
      e2e.components.Panels.Panel.title(title).should('be.visible');
    });

    // Collapse the row and check panels are no longer visible
    e2e.components.DashboardRow.title('Row 2').click();
    panelsToCheck.forEach((title) => {
      e2e.components.Panels.Panel.title(title).should('not.exist');
    });

    // Expand the row and check all panels are visible again
    e2e.components.DashboardRow.title('Row 2').click();
    panelsToCheck.forEach((title) => {
      e2e.components.Panels.Panel.title(title).should('be.visible');
    });
  });
});
