export interface SelectorApi {
  fromAriaLabel: (selector: string) => string;
  fromSelector: (selector: string) => string;
}

export const Selector: SelectorApi = {
  fromAriaLabel: (selector: string) => `[aria-label="${selector}"]`,
  fromSelector: (selector: string) => selector,
};
