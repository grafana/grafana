import { e2e } from '../utils';

describe('Solo Route', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Can view panels with shared queries in fullscreen', () => {
    // open Panel Tests - Bar Gauge
    e2e.pages.SoloPanel.visit('ZqZnVvFZz/datasource-tests-shared-queries?orgId=1&panelId=4');

    cy.get('canvas').should('have.length', 6);
  });

  it('Can view solo panel in scenes', () => {
    // open Panel Tests - Graph NG
    e2e.pages.SoloPanel.visit(
      'TkZXxlNG3/panel-tests-graph-ng?orgId=1&from=1699954597665&to=1699956397665&panelId=54&__feature.dashboardSceneSolo=true'
    );

    e2e.components.Panels.Panel.title('Interpolation: Step before').should('exist');
    cy.contains('uplot-main-div').should('not.exist');
  });

  it('Can view solo repeated panel in scenes', () => {
    // open Panel Tests - Graph NG
    e2e.pages.SoloPanel.visit(
      'templating-repeating-panels/templating-repeating-panels?orgId=1&from=1699934989607&to=1699956589607&panelId=panel-2-clone-0&__feature.dashboardSceneSolo=true'
    );

    e2e.components.Panels.Panel.title('server=A').should('exist');
    cy.contains('uplot-main-div').should('not.exist');
  });

  it('Can view solo in repeated row and panel in scenes', () => {
    // open Panel Tests - Graph NG
    e2e.pages.SoloPanel.visit(
      'Repeating-rows-uid/repeating-rows?orgId=1&var-server=A&var-server=B&var-server=D&var-pod=1&var-pod=2&var-pod=3&panelId=panel-16-clone-1/grid-item-2/panel-2-clone-1&__feature.dashboardSceneSolo=true'
    );

    e2e.components.Panels.Panel.title('server = B, pod = Rob').should('exist');
    cy.contains('uplot-main-div').should('not.exist');
  });
});
