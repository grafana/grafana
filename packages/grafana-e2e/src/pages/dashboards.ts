import { pageFactory } from '../support';

export const Dashboards = pageFactory({
  url: '/dashboards',
  selectors: {
    dashboards: (title: string) => `Dashboard search item ${title}`,
  },
});
