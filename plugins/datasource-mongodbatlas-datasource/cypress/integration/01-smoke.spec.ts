import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Smoke test',
  itName: 'Smoke test',
  scenario: () => {
    e2e.pages.Home.visit();
    e2e().contains('Welcome to Grafana').should('be.visible');
  },
});
