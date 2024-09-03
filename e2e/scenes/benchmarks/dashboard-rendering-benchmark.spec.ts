import { e2e } from '../utils';

const RUNS = 500;

describe('Dashboard rendering benchmark', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('dashboard with a single text panel', () => {
    setupBenchmark('cdt8wrar2blkwe/benchmark3a-single-query');
    const fileName = 'benchmark-single-text-panel.csv';

    runBenchmarkInteraction(RUNS, () => e2e.components.RefreshPicker.runButtonV2().click());
    processBenchmarkResults(fileName);
  });

  it.only('dashboard with a single panel', () => {
    setupBenchmark('cdt8wrar2blkwe/benchmark3a-single-query');
    const fileName = 'benchmark-single-query.csv';

    runBenchmarkInteraction(RUNS, () => e2e.components.RefreshPicker.runButtonV2().click());
    processBenchmarkResults(fileName);
  });

  it('dashboard with a slow panel', () => {
    setupBenchmark('ddt85qfrjpzpce/benchmark3a-slow-front-end-data-source', 5000);
    const fileName = 'benchmark-slow-query.csv';

    runBenchmarkInteraction(RUNS, () => e2e.components.RefreshPicker.runButtonV2().click(), 3000);
    processBenchmarkResults(fileName);
  });

  it('dashboard with a query variable and a single panel', () => {
    setupBenchmark('edt8433nfnzswe/benchmark3a-with-1-query-variable', 5000);
    const fileName = 'benchmarka-with-single-query-variable-and-panel.csv';

    runBenchmarkInteraction(RUNS, () => e2e.components.RefreshPicker.runButtonV2().click(), 3000);
    processBenchmarkResults(fileName);
  });
});

function setupBenchmark(uid: string, wait = 2500) {
  e2e.pages.AddDataSource.visit();
  e2e.pages.AddDataSource.dataSourcePluginsV2('Prometheus')
    .scrollIntoView()
    .should('be.visible') // prevents flakiness
    .click();

  e2e.pages.DataSource.name().clear();
  e2e.pages.DataSource.name().type('prom-demo');
  e2e.components.DataSource.Prometheus.configPage.connectionSettings().type('https://prometheus.demo.do.prometheus.io');
  e2e.pages.DataSource.saveAndTest().click();

  e2e.flows.openDashboard({ uid });
  cy.wait(wait);
}

function processBenchmarkResults(fileName: string) {
  cy.window().then((w) => {
    // @ts-ignore Accessing global echo instance
    const runs = w.__grafanaEcho.backends[0].buffer;
    cy.task('writeBenchmarkResult', { fileName, data: runs });
  });
}

function runBenchmarkInteraction(runs: number = RUNS, interaction: () => void, wait = 2500) {
  for (let i = 0; i < RUNS; i++) {
    let con = false;
    new Promise((resolve) => {
      interaction();
      cy.wait(wait);
      con = true;
      resolve(true);
    });

    while (true) {
      if (con) {
        break;
      }
    }
  }
}
