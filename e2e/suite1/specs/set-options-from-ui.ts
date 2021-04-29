import { e2e } from '@grafana/e2e';

const PAGE_UNDER_TEST = '-Y-tnEDWk/templating-nested-template-variables';

describe('Variables - Set options from ui', () => {
  it('clicking a value that is not part of dependents options should change these to All', () => {
    e2e.flows.login('admin', 'admin');
    e2e.flows.openDashboard({ uid: `${PAGE_UNDER_TEST}?orgId=1&var-datacenter=A&var-server=AA&var-pod=AAA` });
    e2e().intercept('/api/ds/query').as('query');

    e2e().wait('@query');

    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts('Unknown').should('be.visible').click(); // fails as there is no Unknown element
  });
});
