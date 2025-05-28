import { e2e } from '../utils';

const PAGE_UNDER_TEST = 'ed155665/annotation-filtering';

describe('Dashboard', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('can change dashboard description and title', () => {
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1` });

    e2e.flows.scenes.toggleEditMode();

    // Check that current dashboard title is visible in breadcrumb
    cy.get('[aria-label="Breadcrumbs"]').contains('Annotation filtering').should('exist');

    const titleInput = () => cy.get('[aria-label="dashboard-options Title field property editor"] input');
    titleInput().should('have.value', 'Annotation filtering').clear().type('New dashboard title');
    titleInput().should('have.value', 'New dashboard title');

    // Check that new dashboard title is reflected in breadcrumb
    cy.get('[aria-label="Breadcrumbs"]').contains('New dashboard title').should('exist');

    // Check that we can successfully change the dashboard description
    const descriptionTextArea = () =>
      cy.get('[aria-label="dashboard-options Description field property editor"] textarea');
    descriptionTextArea().clear().type('Dashboard description');
    descriptionTextArea().should('have.value', 'Dashboard description');
  });
});
