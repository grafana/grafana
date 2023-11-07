import { e2e } from '../utils';
const PAGE_UNDER_TEST = 'a6801696-cc53-4196-b1f9-2403e3909185/panel-tests-dashlist-variables';

describe('DashList panel', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('should pass current variable values correctly when `Include current template variable values` is set', () => {
    e2e.flows.openDashboard({ uid: PAGE_UNDER_TEST });

    // check the initial value of the urls contain the variable value correctly
    e2e.components.Panels.Panel.title('Dashboard list panel')
      .should('be.visible')
      .within(() => {
        cy.get('a').each(($el) => {
          cy.wrap($el).should('have.attr', 'href').and('contain', 'var-query0=a');
        });
      });

    // update variable to b
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('query0').click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('b').click();
    // blur the dropdown
    cy.get('body').click();

    // check the urls are updated with the new variable value
    e2e.components.Panels.Panel.title('Dashboard list panel')
      .should('be.visible')
      .within(() => {
        cy.get('a').each(($el) => {
          cy.wrap($el).should('have.attr', 'href').and('contain', 'var-query0=b');
        });
      });
  });
});
