// @ts-nocheck
// importing the e2e package in Grafana will cause transpile errors because
// Cypress is an unknown type. Adding the Cypress types would overwrite all jest test types like
// toBe, toEqual and so forth. That's why this file is not type checked and will be so until we
// can solve the above mentioned issue with Cypress/Jest.
import { e2eScenario, ScenarioArguments } from './support/scenario';
import { Components } from './components';
import { Flows } from './flows';
import { Pages } from './pages';
import { getScenarioContext, setScenarioContext } from './support/scenarioContext';

export type SelectorFunction = (text?: string) => Cypress.Chainable<JQuery<HTMLElement>>;
export type VisitFunction = (args?: string) => Cypress.Chainable<Window>;

const e2eObject = {
  env: (args: string) => Cypress.env(args),
  config: () => Cypress.config(),
  blobToBase64String: (blob: any) => Cypress.Blob.blobToBase64String(blob),
  imgSrcToBlob: (url: string) => Cypress.Blob.imgSrcToBlob(url),
  scenario: (args: ScenarioArguments) => e2eScenario(args),
  components: Components,
  flows: Flows,
  pages: Pages,
  getScenarioContext,
  setScenarioContext,
};

export const e2e: (() => Cypress.cy) & typeof e2eObject = Object.assign(() => cy, e2eObject);
