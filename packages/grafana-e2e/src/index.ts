/**
 * A library for writing end-to-end tests for Grafana and its ecosystem.
 *
 * @packageDocumentation
 */
import { e2eScenario, ScenarioArguments } from './support/scenario';
import { getScenarioContext, setScenarioContext } from './support/scenarioContext';
import { e2eFactory } from './support';
import { selectors } from '@grafana/e2e-selectors';
import * as flows from './flows';

const e2eObject = {
  env: (args: string) => Cypress.env(args),
  config: () => Cypress.config(),
  blobToBase64String: (blob: any) => Cypress.Blob.blobToBase64String(blob),
  imgSrcToBlob: (url: string) => Cypress.Blob.imgSrcToBlob(url),
  scenario: (args: ScenarioArguments) => e2eScenario(args),
  pages: e2eFactory({ selectors: selectors.pages }),
  components: e2eFactory({ selectors: selectors.components }),
  flows,
  getScenarioContext,
  setScenarioContext,
};

export const e2e: (() => Cypress.cy) & typeof e2eObject = Object.assign(() => cy, e2eObject);
