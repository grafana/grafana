// @ts-nocheck
// importing the e2e package in Grafana will cause transpile errors because
// Cypress is an unknown type. Adding the Cypress types would overwrite all jest test types like
// toBe, toEqual and so forth. That's why this file is not type checked and will be so until we
// can solve the above mentioned issue with Cypress/Jest.
import { e2eScenario, ScenarioArguments } from './support/scenario';
import { Pages } from './pages';
import { Flows } from './flows';
import { scenarioContext } from './support/scenarioContext';

export type SelectorFunction = (text?: string) => Cypress.Chainable<JQuery<HTMLElement>>;
export type SelectorObject<S> = {
  visit: (args?: string) => Cypress.Chainable<Window>;
  selectors: S;
};

const e2eObject = {
  env: (args: string) => Cypress.env(args),
  config: () => Cypress.config(),
  blobToBase64String: (blob: any) => Cypress.Blob.blobToBase64String(blob),
  imgSrcToBlob: (url: string) => Cypress.Blob.imgSrcToBlob(url),
  scenario: (args: ScenarioArguments) => e2eScenario(args),
  context: scenarioContext,
  pages: Pages,
  flows: Flows,
};

export const e2e: (() => Cypress.cy) & typeof e2eObject = Object.assign(() => cy, e2eObject);
