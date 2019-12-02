import { Flows } from '../flows';

export interface ScenarioArguments {
  describeName: string;
  itName: string;
  scenario: (scenarioDataSourceName?: string) => void;
  skipScenario?: boolean;
  createTestDataSource?: boolean;
}

export const e2eScenario = ({
  describeName,
  itName,
  scenario,
  skipScenario = false,
  createTestDataSource = false,
}: ScenarioArguments) => {
  describe(describeName, () => {
    if (skipScenario) {
      it.skip(itName, async () => {
        expect(false).equals(true);
      });
      return;
    }

    let scenarioDataSource: string;

    beforeEach(() => {
      Flows.login('admin', 'admin');
      if (createTestDataSource) {
        scenarioDataSource = Flows.addDataSource('TestData DB');
      }
    });

    afterEach(() => {
      if (scenarioDataSource) {
        Flows.deleteDataSource(scenarioDataSource);
      }
    });

    it(itName, async () => {
      await scenario(scenarioDataSource);
    });
  });
};
