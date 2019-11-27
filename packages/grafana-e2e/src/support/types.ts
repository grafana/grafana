import { Selector } from './selector';
import { Url } from './url';

export type Selectors = Record<string, string | Function>;
export type PageObjects<S> = { [P in keyof S]: () => Cypress.Chainable<JQuery<HTMLElement>> };

export interface PageObject<S> {
  visit: () => Cypress.Chainable<Window>;
  pageObjects: PageObjects<S>;
}

export abstract class Page<S extends Selectors> implements PageObject<S> {
  constructor() {}

  abstract url: string;
  abstract selectors: S;

  visit() {
    return cy.visit(Url.fromBaseUrl(this.url));
  }

  get pageObjects(): PageObjects<S> {
    const pageObjects = {};
    const keys = Object.keys(this.selectors);
    keys.forEach(key => {
      const value = this.selectors[key];
      if (typeof value === 'string') {
        // @ts-ignore
        pageObjects[key] = () => cy.get(Selector.fromAriaLabel(value));
      }
      if (typeof value === 'function') {
        // @ts-ignore
        pageObjects[key] = () => cy.get(value());
      }
    });

    return pageObjects as PageObjects<S>;
  }
}
