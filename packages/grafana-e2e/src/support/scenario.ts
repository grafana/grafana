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
        e2e.context().get('lastAddedDataSource').then(lastAddedDataSource => {
          if (lastAddedDataSource) {
            e2e.flows.deleteDataSource(lastAddedDataSource);
          }
        });

        e2e.context().get('lastAddedDashboardUid').then(lastAddedDashboardUid => {
          if (lastAddedDashboardUid) {
            e2e.flows.deleteDashboard(lastAddedDashboardUid);
          }
        });
      });

      it(itName, () => scenario());
    }
  });
};
