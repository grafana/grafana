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
          e2e.flows.addDataSource();
        }
        if (addScenarioDashBoard) {
          e2e.flows.addDashboard();
        }
      });

      afterEach(() => {
        // @todo remove `@ts-ignore` when possible
        // @ts-ignore
        e2e.getScenarioContext().then(({ lastAddedDashboardUid, lastAddedDataSource }) => {
          if (lastAddedDataSource) {
            e2e.flows.deleteDataSource(lastAddedDataSource);
          }

          if (lastAddedDashboardUid) {
            e2e.flows.deleteDashboard(lastAddedDashboardUid);
          }
        });
      });

      it(itName, () => scenario());
    }
  });
};
