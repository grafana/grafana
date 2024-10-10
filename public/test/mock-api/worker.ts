import { setupWorker } from 'msw/browser';
import { Scenario, getAdditionalScenarioHandlers } from 'test/mock-api/scenarios';

import allAlertingHandlers from 'app/features/alerting/unified/mocks/server/all-handlers';

const worker = () => {
  // Get scenarios from query params and prepend them to the default handlers
  const scenarioNames = new URLSearchParams(window.location.search).getAll('__scenario') as Scenario[];
  const runtimeScenarios = getAdditionalScenarioHandlers(scenarioNames);
  return setupWorker(...runtimeScenarios, ...allAlertingHandlers);
};

export default worker;
