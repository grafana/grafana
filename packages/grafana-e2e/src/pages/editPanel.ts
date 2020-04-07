import { pageFactory } from '../support';

export const EditPanel = pageFactory({
  url: '',
  selectors: {
    tabItems: (text: string) => `Edit panel tab item ${text}`,
  },
});
