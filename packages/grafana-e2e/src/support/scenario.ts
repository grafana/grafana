import { Flows } from '../flows';

export interface ScenarioContext {
  dataSourceName?: string;
  dashboardTitle?: string;
  dashboardUid?: string;
}

export interface ScenarioArguments {
  describeName: string;
  itName: string;
  scenario: (context: ScenarioContext) => void;
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
    let scenarioDashBoardTitle: string;
    let scenarioDashBoardUid: string;

    beforeEach(async () => {
      Flows.login('admin', 'admin');
      if (addScenarioDataSource) {
        scenarioDataSource = Flows.addDataSource('TestData DB');
      }
      if (addScenarioDashBoard) {
        const { dashboardTitle, uid } = await Flows.addDashboard();
        scenarioDashBoardTitle = dashboardTitle;
        scenarioDashBoardUid = uid;
      }
    });

    afterEach(() => {
      if (scenarioDataSource) {
        Flows.deleteDataSource(scenarioDataSource);
      }
      if (scenarioDashBoardUid) {
        Flows.deleteDashboard(scenarioDashBoardUid);
      }
    });

    it(itName, () => {
      scenario({
        dashboardTitle: scenarioDashBoardTitle,
        dashboardUid: scenarioDashBoardUid,
        dataSourceName: scenarioDataSource,
      });
    });
  });
};
