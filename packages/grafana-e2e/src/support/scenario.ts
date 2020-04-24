import { Flows } from '../flows';
import { getScenarioContext } from './scenarioContext';

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
        Flows.login('admin', 'admin');
        if (addScenarioDataSource) {
          Flows.addDataSource();
        }
        if (addScenarioDashBoard) {
          Flows.addDashboard();
        }
      });

      afterEach(() => {
        // @todo remove `@ts-ignore` when possible
        // @ts-ignore
        getScenarioContext().then(({ lastAddedDashboardUid, lastAddedDataSource }) => {
          if (lastAddedDataSource) {
            Flows.deleteDataSource(lastAddedDataSource);
          }

          if (lastAddedDashboardUid) {
            Flows.deleteDashboard(lastAddedDashboardUid);
          }
        });
      });

      it(itName, () => scenario());
    }
  });
};
