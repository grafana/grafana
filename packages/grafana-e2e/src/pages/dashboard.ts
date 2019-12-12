import { pageFactory } from '../support';

export const Dashboard = pageFactory({
  url: '',
  selectors: {
    toolbarItems: (button: string) => `Dashboard navigation bar button ${button}`,
    backArrow: 'Dashboard settings Go Back button',
  },
});
