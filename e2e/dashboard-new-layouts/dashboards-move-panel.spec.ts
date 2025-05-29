import { e2e } from '../utils';

const PAGE_UNDER_TEST = 'ed155665/annotation-filtering';

describe('Dashboard', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can drag and drop panels', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });

    e2e.flows.scenes.toggleEditMode();

    e2e.flows.scenes.movePanel(/^Panel three$/, /^Panel one$/);
    e2e.components.Panels.Panel.headerContainer()
      .contains(/^Panel three$/)
      .then((panel3) => {
        e2e.components.Panels.Panel.headerContainer()
          .contains(/^Panel one$/)
          .should('be.lowerThan', panel3);
      });

    e2e.flows.scenes.movePanel(/^Panel two$/, /^Panel three$/);
    e2e.components.Panels.Panel.headerContainer()
      .contains(/^Panel three$/)
      .then((panel3) => {
        e2e.components.Panels.Panel.headerContainer()
          .contains(/^Panel two$/)
          .should('be.higherThan', panel3);
      });
  });

  // Note, moving a panel from a nested row to a parent row currently just deletes the panel
  // This test will need to be updated once the correct behavior is implemented.
  it('can move panel from nested row to parent row', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });

    e2e.flows.scenes.toggleEditMode();

    e2e.flows.scenes.groupIntoRow();
    e2e.flows.scenes.groupIntoRow();

    cy.get('[data-testid="data-testid dashboard-row-title-New row"]')
      .first()
      .then((el) => {
        const rect = el.offset();
        e2e.components.Panels.Panel.headerContainer()
          .contains(/^Panel one$/)
          .trigger('pointerdown', { which: 1 })
          .trigger('pointermove', { clientX: rect.left, clientY: rect.top })
          .trigger('pointerup');
      });

    e2e.components.Panels.Panel.headerContainer()
      .contains(/^Panel one$/)
      .should('not.exist');
  });
});
