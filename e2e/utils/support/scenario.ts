import { e2e } from '../';

export interface ScenarioArguments {
  describeName: string;
  itName: string;
  scenario: Function;
  skipScenario?: boolean;
  addScenarioDataSource?: boolean;
  addScenarioDashBoard?: boolean;
  loginViaApi?: boolean;
}

export const e2eScenario = ({
  describeName,
  itName,
  scenario,
  skipScenario = false,
  addScenarioDataSource = false,
  addScenarioDashBoard = false,
  loginViaApi = true,
}: ScenarioArguments) => {
  describe(describeName, () => {
    if (skipScenario) {
      it.skip(itName, () => scenario());
    } else {
      before(() => {
        cy.session(
          'login',
          () => {
            e2e.flows.login(e2e.env('USERNAME'), e2e.env('PASSWORD'), loginViaApi);
          },
          {
            cacheAcrossSpecs: true,
          }
        );
        e2e.flows.setDefaultUserPreferences();
      });

      beforeEach(() => {
        if (addScenarioDataSource) {
          e2e.flows.addDataSource();
        }
        if (addScenarioDashBoard) {
          e2e.flows.addDashboard();
        }
      });

      afterEach(() => e2e.flows.revertAllChanges());

      it(itName, () => scenario());
    }
  });
};
