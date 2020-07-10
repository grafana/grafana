import { e2e } from '../index';
import { DeleteDashboardConfig } from '../flows/deleteDashboard';
import { DeleteDataSourceConfig } from '../flows/deleteDataSource';

export interface ScenarioContext {
  addedDashboards: DeleteDashboardConfig[];
  addedDataSources: DeleteDataSourceConfig[];
  lastAddedDashboard: string; // @todo rename to `lastAddedDashboardTitle`
  lastAddedDashboardUid: string;
  lastAddedDataSource: string; // @todo rename to `lastAddedDataSourceName`
  lastAddedDataSourceId: string;
  [key: string]: any;
}

const scenarioContext: ScenarioContext = {
  addedDashboards: [],
  addedDataSources: [],
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

// @todo this actually returns type `Cypress.Chainable`
export const getScenarioContext = (): any =>
  e2e()
    .wrap({
      getScenarioContext: () => ({ ...scenarioContext } as ScenarioContext),
    })
    .invoke('getScenarioContext');

// @todo this actually returns type `Cypress.Chainable`
export const setScenarioContext = (newContext: Partial<ScenarioContext>): any =>
  e2e()
    .wrap({
      setScenarioContext: () => {
        Object.entries(newContext).forEach(([key, value]) => {
          scenarioContext[key] = value;
        });
      },
    })
    .invoke('setScenarioContext');
