import { e2e } from '../';
import process from 'process';

export interface ScenarioArguments {
  describeName: string;
  itName: string;
  scenario: Function;
  skipScenario?: boolean;
  addScenarioDataSource?: boolean;
  addScenarioDashBoard?: boolean;
}

export const e2eScenario = ({
  describeName,
  itName,
  scenario,
  skipScenario = false,
  addScenarioDataSource = false,
  addScenarioDashBoard = false,
}: ScenarioArguments) => {
  describe(describeName, () => {
    if (skipScenario) {
      it.skip(itName, () => scenario());
    } else {
      before(() => {
        e2e.flows.login(e2e.env('USERNAME'), e2e.env('PASSWORD'));
        cy.getCookie('grafana_session', { log: true }).then(cookie => {
          // @ts-ignore
          process.env.LHCI_EXTRA_HEADERS = `{"Cookie":{"grafana_session":"${cookie?.value}"}}`;
        });
      });

      beforeEach(() => {
        Cypress.Cookies.preserveOnce('grafana_session');

        if (addScenarioDataSource) {
          e2e.flows.addDataSource();
        }
        if (addScenarioDashBoard) {
          e2e.flows.addDashboard();
        }
      });

      afterEach(() => e2e.flows.revertAllChanges());
      after(() => e2e().clearCookies());

      it(itName, () => scenario());

      // @todo remove when possible: https://github.com/cypress-io/cypress/issues/2831
      it('temporary', () => {});
    }
  });
};
