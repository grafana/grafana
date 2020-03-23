import { e2e } from '../index';

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
      beforeEach(() => {
        e2e.flows.login('admin', 'admin');
        if (addScenarioDataSource) {
          e2e.flows.addDataSource('TestData DB');
        }
        if (addScenarioDashBoard) {
          e2e.flows.addDashboard();
        }
      });

      afterEach(() => {
        if (e2e.context().get('lastAddedDataSource')) {
          e2e.flows.deleteDataSource(e2e.context().get('lastAddedDataSource'));
        }
        if (e2e.context().get('lastAddedDashboardUid')) {
          e2e.flows.deleteDashboard(e2e.context().get('lastAddedDashboardUid'));
        }
      });

      it(itName, () => scenario());
    }
  });
};
