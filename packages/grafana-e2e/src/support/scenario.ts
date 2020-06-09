import { e2e } from '../';
import { Flows } from '../flows';

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
        Flows.login(e2e.env('USERNAME'), e2e.env('PASSWORD'));
        if (addScenarioDataSource) {
          Flows.addDataSource();
        }
        if (addScenarioDashBoard) {
          Flows.addDashboard();
        }
      });

      afterEach(() => Flows.revertAllChanges());

      it(itName, () => scenario());
    }
  });
};
