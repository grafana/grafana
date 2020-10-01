import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Templating',
  itName: 'Tests dashboard links and variables in links',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard({ uid: 'yBCC3aKGk' });
    e2e().server();
    e2e()
      .route({
        method: 'GET',
        url: '/api/search?tag=templating&limit=100',
      })
      .as('tagsTemplatingSearch');
    e2e()
      .route({
        method: 'GET',
        url: '/api/search?tag=demo&limit=100',
      })
      .as('tagsDemoSearch');

    // waiting for links to render, couldn't find a better way using routes for instance
    e2e().wait(1000);

    const verifyLinks = (variableValue: string) => {
      e2e.components.DashboardLinks.link()
        .should('be.visible')
        .and(links => {
          expect(links).to.have.length(13);

          for (let index = 0; index < links.length; index++) {
            expect(Cypress.$(links[index]).attr('href')).contains(`var-custom=${variableValue}`);
          }
        });
    };

    e2e.components.DashboardLinks.dropDown()
      .should('be.visible')
      .click()
      .wait('@tagsTemplatingSearch')
      .wait('@tagsDemoSearch');

    // verify all links, should have All value
    verifyLinks('All');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All')
      .should('be.visible')
      .click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('p2')
      .should('be.visible')
      .click();

    e2e.pages.Dashboard.Toolbar.navBar().click();

    e2e.components.DashboardLinks.dropDown()
      .should('be.visible')
      .click()
      .wait('@tagsTemplatingSearch')
      .wait('@tagsDemoSearch');

    // verify all links, should have p2 value
    verifyLinks('p2');
  },
});
