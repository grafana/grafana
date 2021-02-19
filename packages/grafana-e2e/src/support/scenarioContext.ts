export interface ScenarioContext {
  lastAddedDataSource: string;
  lastAddedDashboard: string;
  lastAddedDashboardUid: string;
  [key: string]: any;
}

const scenarioContexts: ScenarioContext = {
  lastAddedDataSource: '',
  lastAddedDashboard: '',
  lastAddedDashboardUid: '',
};

export interface ScenarioContextApi {
  get: <T>(name: string | keyof ScenarioContext) => T;
  set: <T>(name: string | keyof ScenarioContext, value: T) => void;
}

export const scenarioContext = (): ScenarioContextApi => {
  const get = <T>(name: string | keyof ScenarioContext): T => scenarioContexts[name] as T;
  const set = <T>(name: string | keyof ScenarioContext, value: T): void => {
    scenarioContexts[name] = value;
  };

  return {
    get,
    set,
  };
};
