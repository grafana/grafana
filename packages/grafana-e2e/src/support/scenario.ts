import { e2e } from '../index';

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
        // @ts-ignore yarn start in root throws error otherwise
        expect(false).equals(true);
      });
      return;
    }

    let scenarioDataSource: string;
    let scenarioDashBoardTitle: string;
    let scenarioDashBoardUid: string;

    beforeEach(async () => {
      e2e.flows.login('admin', 'admin');
      if (addScenarioDataSource) {
        scenarioDataSource = e2e.flows.addDataSource('TestData DB');
      }
      if (addScenarioDashBoard) {
        const { dashboardTitle, uid } = await e2e.flows.addDashboard();
        scenarioDashBoardTitle = dashboardTitle;
        scenarioDashBoardUid = uid;
      }
    });

    afterEach(() => {
      if (scenarioDataSource) {
        e2e.flows.deleteDataSource(scenarioDataSource);
      }
      if (scenarioDashBoardUid) {
        e2e.flows.deleteDashboard(scenarioDashBoardUid);
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
