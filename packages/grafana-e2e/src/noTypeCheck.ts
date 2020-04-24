import { e2eScenario, ScenarioArguments } from './support/scenario';
import { Pages } from './pages';
import { Components } from './components';
import { Flows } from './flows';
import { getScenarioContext, setScenarioContext } from './support/scenarioContext';

export type SelectorFunction = (text?: string) => Cypress.Chainable<JQuery<HTMLElement>>;
export type VisitFunction = (args?: string) => Cypress.Chainable<Window>;

const e2eObject = {
  env: (args: string) => Cypress.env(args),
  config: () => Cypress.config(),
  blobToBase64String: (blob: any) => Cypress.Blob.blobToBase64String(blob),
  imgSrcToBlob: (url: string) => Cypress.Blob.imgSrcToBlob(url),
  scenario: (args: ScenarioArguments) => e2eScenario(args),
  pages: Pages,
  components: Components,
  flows: Flows,
  getScenarioContext,
  setScenarioContext,
};

export const e2e: (() => Cypress.cy) & typeof e2eObject = Object.assign(() => cy, e2eObject);
