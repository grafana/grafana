import { Selector } from './selector';
import { fromBaseUrl } from './url';
import { e2e } from '../index';

export type SelectorFunction = (text?: string) => Cypress.Chainable<JQuery<HTMLElement>>;
export type VisitFunction = (args?: string) => Cypress.Chainable<Window>;
export type Selectors = Record<string, string | Function>;
export type SelectorFunctions<S> = { [P in keyof S]: SelectorFunction };

export type Page<S> = SelectorFunctions<S> & {
  selectors: S;
  visit: VisitFunction;
};
export interface PageFactoryArgs<S> {
  selectors: S;
  url?: string | Function;
}

export const pageFactory = <S extends Selectors>({ url, selectors }: PageFactoryArgs<S>): Page<S> => {
  const visit = (args?: string) => {
    if (!url) {
      return e2e().visit('');
    }

    let parsedUrl = '';
    if (typeof url === 'string') {
      parsedUrl = fromBaseUrl(url);
    }

    if (typeof url === 'function' && args) {
      parsedUrl = fromBaseUrl(url(args));
    }

    e2e().logToConsole('Visiting', parsedUrl);
    return e2e().visit(parsedUrl);
  };
  const pageObjects: SelectorFunctions<S> = {} as SelectorFunctions<S>;
  const keys = Object.keys(selectors);

  keys.forEach(key => {
    const value = selectors[key];
    if (typeof value === 'string') {
      // @ts-ignore
      pageObjects[key] = () => {
        e2e().logToConsole('Retrieving Selector:', value);
        return e2e().get(Selector.fromAriaLabel(value));
      };
    }
    if (typeof value === 'function') {
      // @ts-ignore
      pageObjects[key] = (text?: string) => {
        if (!text) {
          const selector = value();
          e2e().logToConsole('Retrieving Selector:', selector);
          return e2e().get(selector);
        }
        const selector = value(text);
        e2e().logToConsole('Retrieving Selector:', selector);
        return e2e().get(Selector.fromAriaLabel(selector));
      };
    }
  });

  return {
    visit,
    ...pageObjects,
    selectors,
  };
};

type Component<S> = Omit<Page<S>, 'visit'>;
type ComponentFactoryArgs<S> = Omit<PageFactoryArgs<S>, 'url'>;

export const componentFactory = <S extends Selectors>(args: ComponentFactoryArgs<S>): Component<S> => {
  const { visit, ...rest } = pageFactory(args);
  return rest;
};
