import { e2e } from '../utils';

const DASHBOARD_ID = 'c01bf42b-b783-4447-a304-8554cee1843b';
const DATAGRID_CANVAS = 'data-grid-canvas';

//TODO enable this test when panel goes live
describe.skip('Datagrid data changes', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Tests changing data in the grid', () => {
    e2e.flows.openDashboard({ uid: DASHBOARD_ID, queryParams: { editPanel: 1 } });

    // Edit datagrid which triggers a snapshot query
    cy.get('.dvn-scroller').click(200, 100);
    cy.get('[data-testid="glide-cell-2-1"]').should('have.attr', 'aria-selected', 'true');
    cy.get('body').type('123{enter}', { delay: 500 });

    cy.get('[data-testid="data-testid Confirm Modal Danger Button"]').click();

    // Delete a cell
    cy.get('.dvn-scroller').click(200, 200);
    cy.get('body').type('{del}');
    cy.get('[data-testid="glide-cell-2-4"]').should('have.text', 0);

    // Delete a selection
    cy.get('.dvn-scroller').click(50, 100, { shiftKey: true });
    cy.get('body').type('{del}');
    cy.get('[data-testid="glide-cell-2-3"]').should('have.text', 0);
    cy.get('[data-testid="glide-cell-2-2"]').should('have.text', 0);
    cy.get('[data-testid="glide-cell-2-1"]').should('have.text', 0);
    cy.get('[data-testid="glide-cell-2-0"]').should('have.text', 1);
    cy.get('[data-testid="glide-cell-1-3"]').should('have.text', '');
    cy.get('[data-testid="glide-cell-1-2"]').should('have.text', '');
    cy.get('[data-testid="glide-cell-1-1"]').should('have.text', '');
    cy.get('[data-testid="glide-cell-1-0"]').should('not.have.text', '');

    // Clear column through context menu
    cy.get('.dvn-scroller').rightclick(200, 100);
    cy.get('[aria-label="Context menu"]').click(100, 120); // click clear column
    cy.get('[data-testid="glide-cell-2-0"]').should('have.text', 0);
    cy.get('[data-testid="glide-cell-2-4"]').should('have.text', 0);

    // Clear row through context menu
    cy.get('.dvn-scroller').click(200, 220);
    cy.get('body').type('1123{enter}', { delay: 500 });
    cy.get('.dvn-scroller').rightclick(200, 220);
    cy.get('[aria-label="Context menu"]').click(100, 100); // click clear row
    cy.get('[data-testid="glide-cell-1-4"]').should('have.text', '');
    cy.get('[data-testid="glide-cell-2-4"]').should('have.text', 0);

    // get the data back
    cy.reload();

    // Clear row through row selector
    cy.get('.dvn-scroller').click(20, 190, { waitForAnimations: true });
    cy.get('.dvn-scroller').click(20, 90, { shiftKey: true, waitForAnimations: true }); // with shift to select all rows between clicks
    cy.get('body').type('{del}');
    cy.get('[data-testid="data-testid Confirm Modal Danger Button"]').click();
    cy.get('[data-testid="glide-cell-1-4"]').should('have.text', '');
    cy.get('[data-testid="glide-cell-1-3"]').should('have.text', '');
    cy.get('[data-testid="glide-cell-1-2"]').should('have.text', '');
    cy.get('[data-testid="glide-cell-1-1"]').should('have.text', '');
    cy.get('[data-testid="glide-cell-2-4"]').should('have.text', 0);
    cy.get('[data-testid="glide-cell-2-3"]').should('have.text', 0);
    cy.get('[data-testid="glide-cell-2-2"]').should('have.text', 0);
    cy.get('[data-testid="glide-cell-2-1"]').should('have.text', 0);
    cy.wait(1000);
    cy.reload();
    cy.get('.dvn-scroller').click(20, 190, { waitForAnimations: true });
    cy.get('.dvn-scroller').click(20, 90, { commandKey: true, waitForAnimations: true }); // with cmd to select only clicked rows
    cy.get('body').type('{del}');

    cy.get('[data-testid="data-testid Confirm Modal Danger Button"]').click();

    cy.get('[data-testid="glide-cell-1-1"]').should('have.text', '');
    cy.get('[data-testid="glide-cell-2-1"]').should('have.text', 0);
    cy.get('[data-testid="glide-cell-2-4"]').should('have.text', 0);
    cy.get('[data-testid="glide-cell-1-4"]').should('have.text', '');

    // Remove all data
    cy.get('.dvn-scroller').rightclick(100, 100);
    cy.get('body').click(150, 420);
    cy.get(`[data-testid="${DATAGRID_CANVAS}"] th`).should('have.length', 0);

    cy.reload();

    // Delete column through header dropdown menu
    cy.get('.dvn-scroller').click(250, 15); // click header dropdown
    cy.get('body').click(450, 420); // click delete column
    cy.get('[data-testid="data-testid Confirm Modal Danger Button"]').click();
    cy.get(`[data-testid="${DATAGRID_CANVAS}"] th`).should('have.length', 1);

    // Delete row through context menu
    cy.get('.dvn-scroller').rightclick(100, 100);
    cy.get('[aria-label="Context menu"]').click(10, 10);
    cy.get(`[data-testid="${DATAGRID_CANVAS}"] tbody tr`).should('have.length', 6); // there are 5 data rows + 1 for the add new row btns

    // Delete rows through row selector
    cy.get('.dvn-scroller').click(20, 190, { waitForAnimations: true });
    cy.get('.dvn-scroller').click(20, 90, { shiftKey: true, waitForAnimations: true }); // with shift to select all rows between clicks
    cy.get('.dvn-scroller').rightclick(100, 100);
    cy.get('[aria-label="Context menu"]').click(10, 10);
    cy.get(`[data-testid="${DATAGRID_CANVAS}"] tbody tr`).should('have.length', 2); // there are 1 data rows + 1 for the add new row btns
    cy.reload();
    cy.get('.dvn-scroller').click(20, 190, { waitForAnimations: true });
    cy.get('.dvn-scroller').click(20, 90, { commandKey: true, waitForAnimations: true }); // with shift to select all rows between clicks
    cy.get('.dvn-scroller').rightclick(40, 90);
    cy.get('[aria-label="Context menu"]').click(10, 10);
    cy.get('[data-testid="data-testid Confirm Modal Danger Button"]').click();
    cy.get(`[data-testid="${DATAGRID_CANVAS}"] tbody tr`).should('have.length', 5); // there are 5 data rows + 1 for the add new row btns

    // Delete column through context menu
    cy.get('.dvn-scroller').rightclick(100, 100);
    cy.get('[aria-label="Context menu"]').click(10, 50);
    cy.get(`[data-testid="${DATAGRID_CANVAS}"] th`).should('have.length', 1);

    cy.reload();
    cy.wait(3000);

    // Add a new column
    cy.get('body').click(350, 200).type('New Column{enter}');
    cy.get('[data-testid="data-testid Confirm Modal Danger Button"]').click();
    cy.get('body')
      .click(350, 230)
      .type('Value 1{enter}')
      .type('Value 2{enter}')
      .type('Value 3{enter}')
      .type('Value 4{enter}')
      .type('Value 5{enter}')
      .type('Value 6{enter}');
    cy.get(`[data-testid="${DATAGRID_CANVAS}"] th`).should('have.length', 3);

    // Rename a column
    cy.get('.dvn-scroller').click(250, 15); // click header dropdown
    cy.get('body').click(450, 380).type('{selectall}{backspace}Renamed column{enter}');
    cy.get(`[data-testid="${DATAGRID_CANVAS}"] th`).contains('Renamed column');

    // Change column field type
    cy.get('.dvn-scroller').click(310, 15);
    cy.get('[aria-label="Context menu"]').click(50, 50);
    cy.get('.dvn-scroller').click(200, 100);
    cy.get('body').type('Str Value{enter}');
    cy.get(`[data-testid="${DATAGRID_CANVAS}"] tr`).contains('Str Value');

    // Select all rows through row selection
    cy.get('.dvn-scroller').click(10, 10, { waitForAnimations: true });
    cy.get(`[data-testid="${DATAGRID_CANVAS}"] [aria-selected="true"]`).should('have.length', 6);

    // Add a new row
    cy.get('.dvn-scroller').click(200, 250);
    cy.get('body').type('123');
    cy.get('.dvn-scroller').click(50, 250);
    cy.get('body').type('Val{enter}');
    cy.get(`[data-testid="${DATAGRID_CANVAS}"] tbody tr`).contains('Val');
    cy.get(`[data-testid="${DATAGRID_CANVAS}"] tbody tr`).should('have.length', 8);
  });
});
