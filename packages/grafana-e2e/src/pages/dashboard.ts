import { pageFactory } from '../support';

export const Dashboard = pageFactory({
  url: (uid: string) => `/d/${uid}`,
  selectors: {
    toolbarItems: (button: string) => `Dashboard navigation bar button ${button}`,
    backArrow: 'Dashboard settings Go Back button',
    navBar: () => '.navbar',
  },
});
