import { e2e } from '../utils';

const RUNS = 20;

describe('Dashboard rendering benchmark', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('dashboard with a single panel', () => {
    setupBenchmark('cdt8wrar2blkwe/benchmark3a-single-query');
    const fileName = 'benchmark3a-slow-query.csv';

    runBenchmarkInteraction(RUNS, () => e2e.components.RefreshPicker.runButtonV2().click());
    processBenchmarkResults(fileName);

    e2e.components.Panels.Panel.content().should('have.length', 1);
  });

  it('dashboard with a slow panel', () => {
    setupBenchmark('ddt85qfrjpzpce/benchmark3a-slow-front-end-data-source', 5000);
    const fileName = 'benchmark-slow-query.csv';

    runBenchmarkInteraction(RUNS, () => e2e.components.RefreshPicker.runButtonV2().click(), 3000);
    processBenchmarkResults(fileName);

    e2e.components.Panels.Panel.content().should('have.length', 1);
  });
});

function setupBenchmark(uid: string, wait = 2500) {
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
