import { Selector } from './selector';
import { fromBaseUrl } from './url';
import { e2e } from '../index';
import { SelectorFunction, SelectorObject } from '../noTypeCheck';

export type Selectors = Record<string, string | Function>;
export type PageObjects<S> = { [P in keyof S]: SelectorFunction };
export type PageFactory<S> = PageObjects<S> & SelectorObject<S>;
export interface PageFactoryArgs<S extends Selectors> {
  url?: string | Function;
  selectors: S;
}

export const pageFactory = <S extends Selectors>({ url, selectors }: PageFactoryArgs<S>): PageFactory<S> => {
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
  const pageObjects: PageObjects<S> = {} as PageObjects<S>;
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
