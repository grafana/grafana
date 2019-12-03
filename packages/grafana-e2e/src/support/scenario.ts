import { Flows } from '../flows';

export interface ScenarioArguments {
  describeName: string;
  itName: string;
  scenario: (scenarioDataSourceName?: string, scenarioDashBoard?: string) => void;
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
      it.skip(itName, () => {
        expect(false).equals(true);
      });
      return;
    }

    let scenarioDataSource: string;
    let scenarioDashBoard: string;

    beforeEach(() => {
      Flows.login('admin', 'admin');
      if (addScenarioDataSource) {
        scenarioDataSource = Flows.addDataSource('TestData DB');
      }
      if (addScenarioDashBoard) {
        scenarioDashBoard = Flows.addDashboard();
      }
    });

    afterEach(() => {
      if (scenarioDataSource) {
        Flows.deleteDataSource(scenarioDataSource);
      }
      if (scenarioDashBoard) {
        Flows.deleteDashboard(scenarioDashBoard);
      }
    });

    it(itName, () => {
      scenario(scenarioDataSource, scenarioDashBoard);
    });
  });
};
