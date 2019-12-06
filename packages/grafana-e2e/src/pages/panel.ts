import { pageFactory } from '../support';

export const Panel = pageFactory({
  url: '',
  selectors: {
    title: (title: string) => `Panel header title item ${title}`,
    headerItems: (item: string) => `Panel header item ${item}`,
  },
});
