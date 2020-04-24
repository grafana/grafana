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
  // when we started to use import { e2e } from '@grafana/e2e'; in grafana/ui components
  // then type checking @grafana/run-time started to fail with
  // Cannot find name 'describe'. Do you need to install type definitions for a test runner? Try `npm i @types/jest` or `npm i @types/mocha`.
  // Haven't investigated deeper why this happens yet so adding ts-ignore as temporary solution
  // @todo remove `@ts-ignore` when possible
  // @ts-ignore
  describe(describeName, () => {
    if (skipScenario) {
      // @todo remove `@ts-ignore` when possible
      // @ts-ignore
      it.skip(itName, () => scenario());
    } else {
      // @todo remove `@ts-ignore` when possible
      // @ts-ignore
      beforeEach(() => {
        Flows.login('admin', 'admin');
        if (addScenarioDataSource) {
          Flows.addDataSource();
        }
        if (addScenarioDashBoard) {
          Flows.addDashboard();
        }
      });

      // @todo remove `@ts-ignore` when possible
      // @ts-ignore
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

      // @todo remove `@ts-ignore` when possible
      // @ts-ignore
      it(itName, () => scenario());
    }
  });
};
