import { e2e } from '../utils';

import { flows } from './dashboard-edit-flows';

const PAGE_UNDER_TEST = '5SdHCadmz/panel-tests-graph';

describe('Dashboard', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can edit panel title and description', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });

    e2e.flows.scenes.toggleEditMode();

    const oldTitle = 'No Data Points Warning';
    flows.firstPanelTitleShouldBe(oldTitle);

    const newDescription = 'A description of this panel';
    flows.changePanelDescription(oldTitle, newDescription);

    const newTitle = 'New Panel Title';
    flows.changePanelTitle(oldTitle, newTitle);

    // Check that new title is reflected in panel header
    flows.firstPanelTitleShouldBe(newTitle);

    // Reveal description tooltip and check that its value is as expected
    const descriptionIcon = () => cy.get('[data-testid="title-items-container"] > span').first();
    descriptionIcon().click({ force: true });
    descriptionIcon().then((el) => {
      const tooltipId = el.attr('aria-describedby');
      cy.get(`[id="${tooltipId}"]`).should('have.text', `${newDescription}\n`);
    });
  });
});
