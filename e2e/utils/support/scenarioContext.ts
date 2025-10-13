import { DeleteDashboardConfig } from '../flows/deleteDashboard';
import { DeleteDataSourceConfig } from '../flows/deleteDataSource';

export interface ScenarioContext {
  addedDashboards: DeleteDashboardConfig[];
  addedDataSources: DeleteDataSourceConfig[];
  lastAddedDashboard: string; // @todo rename to `lastAddedDashboardTitle`
  lastAddedDashboardUid: string;
  lastAddedDataSource: string; // @todo rename to `lastAddedDataSourceName`
  lastAddedDataSourceId: string;
  hasChangedUserPreferences: boolean;
}

const scenarioContext: ScenarioContext = {
  addedDashboards: [],
  addedDataSources: [],
  hasChangedUserPreferences: false,
  get lastAddedDashboard() {
    return lastProperty(this.addedDashboards, 'title');
  },
  get lastAddedDashboardUid() {
    return lastProperty(this.addedDashboards, 'uid');
  },
  get lastAddedDataSource() {
    return lastProperty(this.addedDataSources, 'name');
  },
  get lastAddedDataSourceId() {
    return lastProperty(this.addedDataSources, 'id');
  },
};

const lastProperty = <T extends DeleteDashboardConfig | DeleteDataSourceConfig, K extends keyof T>(
  items: T[],
  key: K
) => items[items.length - 1]?.[key] ?? '';

export const getScenarioContext = (): Cypress.Chainable<ScenarioContext> =>
  cy
    .wrap(
      {
        getScenarioContext: (): ScenarioContext => ({ ...scenarioContext }),
      },
      { log: false }
    )
    .invoke({ log: false }, 'getScenarioContext');

export const setScenarioContext = (newContext: Partial<ScenarioContext>): Cypress.Chainable<ScenarioContext> =>
  cy
    .wrap(
      {
        setScenarioContext: () => {
          Object.assign(scenarioContext, newContext);
        },
      },
      { log: false }
    )
    .invoke({ log: false }, 'setScenarioContext');
