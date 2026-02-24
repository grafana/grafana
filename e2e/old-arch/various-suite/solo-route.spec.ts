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
});

// Scenes solo panel tests - these require dashboardScene=true and a fresh app load
describe('Solo Route (Scenes)', () => {
  beforeEach(() => {
    // Override the old-arch default and enable scenes
    cy.setLocalStorage('grafana.featureToggles', 'dashboardScene=true');
    // Reload to pick up the new toggle before routes are initialized
    cy.reload();
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'), false);
  });

  it('Can view solo panel in scenes', () => {
    e2e.pages.SoloPanel.visit('TkZXxlNG3/panel-tests-graph-ng?orgId=1&from=1699954597665&to=1699956397665&panelId=54');

    e2e.components.Panels.Panel.title('Interpolation: Step before').should('exist');
    cy.contains('uplot-main-div').should('not.exist');
  });

  it('Can view solo repeated panel in scenes', () => {
    e2e.pages.SoloPanel.visit(
      'templating-repeating-panels/templating-repeating-panels?orgId=1&from=1699934989607&to=1699956589607&panelId=A$panel-2'
    );

    e2e.components.Panels.Panel.title('server=A').should('exist');
    cy.contains('uplot-main-div').should('not.exist');
  });

  it('Can view solo in repeated row and panel in scenes', () => {
    e2e.pages.SoloPanel.visit(
      'Repeating-rows-uid/repeating-rows?orgId=1&var-server=A&var-server=B&var-server=D&var-pod=1&var-pod=2&var-pod=3&panelId=B$2$panel-2'
    );

    e2e.components.Panels.Panel.title('server = B, pod = Rob').should('exist');
    cy.contains('uplot-main-div').should('not.exist');
  });
});
