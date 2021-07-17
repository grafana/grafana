export interface SelectorApi {
  fromAriaLabel: (selector: string) => string;
  fromDataTestId: (selector: string) => string;
  fromSelector: (selector: string) => string;
}

export const Selector: SelectorApi = {
  fromAriaLabel: (selector: string) => `[aria-label="${selector}"]`,
  fromDataTestId: (selector: string) => `[data-test-id="${selector}"]`,
  fromSelector: (selector: string) => selector,
};
