import { HttpHandler } from 'msw';

import { SILENCES_SCENARIOS } from './scenarios/alerting/silences';

const ALL_SCENARIOS = {
  ...SILENCES_SCENARIOS,
};

export type Scenario = keyof typeof ALL_SCENARIOS;

/**
 * Turns a list of scenario names into handlers that need to be `.use`'d by mock server/worker
 * in order to make the scenarios "happen"
 */
export const getAdditionalScenarioHandlers = (scenarios: Scenario[]) => {
  const initial: HttpHandler[] = [];
  return scenarios.reduce((handlers, name) => {
    const handlersToUse = ALL_SCENARIOS[name];

    if (handlersToUse) {
      return handlers.concat(handlersToUse);
    }
    return handlers;
  }, initial);
};
