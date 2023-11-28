import { E2ESelectors, Selectors, selectors } from '@grafana/e2e-selectors';

import * as flows from './flows';
import { e2eFactory } from './support';
import { benchmark } from './support/benchmark';
import { getScenarioContext, setScenarioContext } from './support/scenarioContext';
import * as typings from './typings';

export const e2e = {
  benchmark,
  pages: e2eFactory({ selectors: selectors.pages }),
  typings,
  components: e2eFactory({ selectors: selectors.components }),
  flows,
  getScenarioContext,
  setScenarioContext,
  getSelectors: <T extends Selectors>(selectors: E2ESelectors<T>) => e2eFactory({ selectors }),
};
