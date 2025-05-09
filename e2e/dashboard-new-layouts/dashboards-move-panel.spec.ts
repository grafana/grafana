import { e2e } from '../utils';

const PAGE_UNDER_TEST = 'ed155665/annotation-filtering';

describe('Dashboard', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can drag and drop panels', () => {
    e2e.pages.Dashboards.visit();
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
});
