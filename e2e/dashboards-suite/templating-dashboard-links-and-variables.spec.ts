import { e2e } from '@grafana/e2e';
import { GrafanaBootConfig } from '@grafana/runtime';

e2e.scenario({
  describeName: 'Templating',
  itName: 'Tests dashboard links and variables in links',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e()
      .intercept({
        method: 'GET',
        url: '/api/search?tag=templating&limit=100',
      })
      .as('tagsTemplatingSearch');
    e2e()
      .intercept({
        method: 'GET',
        url: '/api/search?tag=demo&limit=100',
      })
      .as('tagsDemoSearch');

    e2e.flows.openDashboard({ uid: 'yBCC3aKGk' });

    // waiting for network requests first
    e2e().wait(['@tagsTemplatingSearch', '@tagsDemoSearch']);

    const verifyLinks = (variableValue: string) => {
      e2e.components.DashboardLinks.link()
        .should('be.visible')
        .should((links) => {
          expect(links).to.have.length.greaterThan(13);

          for (let index = 0; index < links.length; index++) {
            expect(Cypress.$(links[index]).attr('href')).contains(`var-custom=${variableValue}`);
          }
        });
    };

    e2e.components.DashboardLinks.dropDown().should('be.visible').click().wait('@tagsTemplatingSearch');

    // verify all links, should have All value
    verifyLinks('All');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('All').should('be.visible').click();

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('p2').should('be.visible').click();

    e2e()
      .window()
      .then((win: Cypress.AUTWindow & { grafanaBootData: GrafanaBootConfig['bootData'] }) => {
        if (win.grafanaBootData.settings.featureToggles.topnav) {
          e2e.components.NavToolbar.container().click();
        } else {
          e2e.components.PageToolbar.container().click();
        }
      });
    e2e.components.DashboardLinks.dropDown()
      .scrollIntoView()
      .should('be.visible')
      .click()
      .wait('@tagsTemplatingSearch');

    // verify all links, should have p2 value
    verifyLinks('p2');
  },
});
