import { pageFactory } from '../support';

export const VariablesSection = pageFactory({
  url: '',
  selectors: {
    addVariableCTA: (item: string) => `Call to action button ${item}`,
  },
});
