import { e2e } from '../index';

export interface ScenarioContext {
  lastAddedDashboard: string;
  lastAddedDashboardUid: string;
  lastAddedDataSource: string;
  lastAddedDataSourceId: string;
  [key: string]: any;
}

const scenarioContext: ScenarioContext = {
  lastAddedDashboard: '',
  lastAddedDashboardUid: '',
  lastAddedDataSource: '',
  lastAddedDataSourceId: '',
};

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
