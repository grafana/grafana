// @ts-nocheck
import { e2eScenario, ScenarioArguments } from './support/scenario';
import { Pages } from './pages';
import { Flows } from './flows';

export type SelectorFunction = (text?: string) => Cypress.Chainable<any>;
export type SelectorObject<S> = { visit: () => Cypress.Chainable<any>; selectors: S };

const e2eObject = {
  env: (args: string) => Cypress.env(args),
  config: () => Cypress.config(),
  blobToBase64String: (blob: any) => Cypress.Blob.blobToBase64String(blob),
  imgSrcToBlob: (url: string) => Cypress.Blob.imgSrcToBlob(url),
  scenario: (args: ScenarioArguments) => e2eScenario(args),
  pages: Pages,
  flows: Flows,
};

export const e2e: (() => Cypress.cy) & typeof e2eObject = Object.assign(() => cy, e2eObject);
