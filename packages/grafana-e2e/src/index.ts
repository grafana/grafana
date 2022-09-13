/**
 * A library for writing end-to-end tests for Grafana and its ecosystem.
 *
 * @packageDocumentation
 */
import { E2ESelectors, Selectors, selectors } from '@grafana/e2e-selectors';

import * as flows from './flows';
import { e2eFactory } from './support';
import { benchmark } from './support/benchmark';
import { e2eScenario, ScenarioArguments } from './support/scenario';
import { getScenarioContext, setScenarioContext } from './support/scenarioContext';
import * as typings from './typings';

const e2eObject = {
  env: (args: string) => Cypress.env(args),
  config: () => Cypress.config(),
  blobToBase64String: (blob: Blob) => Cypress.Blob.blobToBase64String(blob),
  imgSrcToBlob: (url: string) => Cypress.Blob.imgSrcToBlob(url),
  scenario: (args: ScenarioArguments) => e2eScenario(args),
  benchmark,
  pages: e2eFactory({ selectors: selectors.pages }),
  typings,
  components: e2eFactory({ selectors: selectors.components }),
  flows,
  getScenarioContext,
  setScenarioContext,
  getSelectors: <T extends Selectors>(selectors: E2ESelectors<T>) => e2eFactory({ selectors }),
};

export const e2e: (() => Cypress.cy) & typeof e2eObject = Object.assign(() => cy, e2eObject);
