import { CssSelector, FunctionSelector, Selectors, StringSelector, UrlSelector } from '@grafana/e2e-selectors';

import { Selector } from './selector';
import { fromBaseUrl } from './url';

export type VisitFunction = (args?: string, queryParams?: object) => Cypress.Chainable<Window>;
export type E2EVisit = { visit: VisitFunction };
export type E2EFunction = ((text?: string, options?: CypressOptions) => Cypress.Chainable<JQuery<HTMLElement>>) &
  E2EFunctionWithOnlyOptions;
export type E2EFunctionWithOnlyOptions = (options?: CypressOptions) => Cypress.Chainable<JQuery<HTMLElement>>;

export type TypeSelectors<S> = S extends StringSelector
  ? E2EFunctionWithOnlyOptions
  : S extends FunctionSelector
    ? E2EFunction
    : S extends CssSelector
      ? E2EFunction
      : S extends UrlSelector
        ? E2EVisit & Omit<E2EFunctions<S>, 'url'>
        : S extends Record<string, string | FunctionSelector | CssSelector | UrlSelector | Selectors>
          ? E2EFunctions<S>
          : S;

export type E2EFunctions<S extends Selectors> = {
  [P in keyof S]: TypeSelectors<S[P]>;
};

export type E2EObjects<S extends Selectors> = E2EFunctions<S>;

export type E2EFactoryArgs<S extends Selectors> = { selectors: S };

export type CypressOptions = Partial<Cypress.Loggable & Cypress.Timeoutable & Cypress.Withinable & Cypress.Shadow>;

const processSelectors = <S extends Selectors>(e2eObjects: E2EFunctions<S>, selectors: S): E2EFunctions<S> => {
  const logSelectorsInfo = Boolean(Cypress.env('LOG_SELECTORS_INFO'));
  const logOutput = logSelectorsInfo ? (data: unknown) => cy.logToConsole('Retrieving Selector:', data) : () => {};

  const keys = Object.keys(selectors);
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    const value = selectors[key];

    if (key === 'url') {
      // @ts-ignore
      e2eObjects['visit'] = (args?: string, queryParams?: object) => {
        let parsedUrl = '';
        if (typeof value === 'string') {
          parsedUrl = fromBaseUrl(value);
        }

        if (typeof value === 'function' && args) {
          parsedUrl = fromBaseUrl(value(args));
        }

        cy.logToConsole('Visiting', parsedUrl);
        if (queryParams) {
          return cy.visit({ url: parsedUrl, qs: queryParams });
        } else {
          return cy.visit(parsedUrl);
        }
      };

      continue;
    }

    if (typeof value === 'string') {
      // @ts-ignore
      e2eObjects[key] = (options?: CypressOptions) => {
        logOutput(value);
        const selector = value.startsWith('data-testid')
          ? Selector.fromDataTestId(value)
          : Selector.fromAriaLabel(value);

        return cy.get(selector, options);
      };

      continue;
    }

    if (typeof value === 'function') {
      // @ts-ignore
      e2eObjects[key] = function (textOrOptions?: string | CypressOptions, options?: CypressOptions) {
        // the input can only be ()
        if (arguments.length === 0) {
          const selector = value('');

          logOutput(selector);
          return cy.get(selector);
        }

        // the input can be (text) or (options)
        if (arguments.length === 1) {
          if (typeof textOrOptions === 'string') {
            const selectorText = value(textOrOptions);
            const selector = selectorText.startsWith('data-testid')
              ? Selector.fromDataTestId(selectorText)
              : Selector.fromAriaLabel(selectorText);

            logOutput(selector);
            return cy.get(selector);
          }
          const selector = value('');

          logOutput(selector);
          return cy.get(selector, textOrOptions);
        }

        // the input can only be (text, options)
        if (arguments.length === 2 && typeof textOrOptions === 'string') {
          const text = textOrOptions;
          const selectorText = value(text);
          const selector = text.startsWith('data-testid')
            ? Selector.fromDataTestId(selectorText)
            : Selector.fromAriaLabel(selectorText);

          logOutput(selector);
          return cy.get(selector, options);
        }
      };

      continue;
    }

    if (typeof value === 'object') {
      // @ts-ignore
      e2eObjects[key] = processSelectors({}, value);
    }
  }

  return e2eObjects;
};

export const e2eFactory = <S extends Selectors>({ selectors }: E2EFactoryArgs<S>): E2EObjects<S> => {
  const e2eObjects: E2EFunctions<S> = {} as E2EFunctions<S>;
  processSelectors(e2eObjects, selectors);

  return { ...e2eObjects };
};
