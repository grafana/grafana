import { e2e } from '../index';

export interface ScenarioContext {
  lastAddedDashboard: string;
  lastAddedDashboardUid: string;
  lastAddedDataSource: string;
  [key: string]: any;
}

const store: ScenarioContext = {
  lastAddedDashboard: '',
  lastAddedDashboardUid: '',
  lastAddedDataSource: '',
};

const getScenarioContext = <T>(key: string | keyof ScenarioContext): Cypress.Chainable => e2e()
  .wrap({
    getScenarioContext: (): T => store[key] as T,
  })
  .invoke('getScenarioContext');

const setScenarioContext = <T>(key: string | keyof ScenarioContext, value: T): Cypress.Chainable => e2e()
  .wrap({
    setScenarioContext: () => {
      store[key] = value;
    },
  })
  .invoke('setScenarioContext');

export const scenarioContext = () => ({
  get: getScenarioContext,
  set: setScenarioContext,
});
