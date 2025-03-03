import { e2e } from '../';

export interface BenchmarkArguments {
  name: string;
  dashboard: {
    folder: string;
    delayAfterOpening: number;
    skipPanelValidation: boolean;
  };
  repeat: number;
  duration: number;
  appStats?: {
    startCollecting?: (window: Window) => void;
    collect: (window: Window) => Record<string, unknown>;
  };
  skipScenario?: boolean;
}

export const benchmark = ({
  name,
  skipScenario = false,
  repeat,
  duration,
  appStats,
  dashboard,
}: BenchmarkArguments) => {
  if (skipScenario) {
    describe(name, () => {
      it.skip(name, () => {});
    });
  } else {
    describe(name, () => {
      beforeEach(() => {
        e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
        e2e.flows.importDashboards(dashboard.folder, 1000, dashboard.skipPanelValidation);
      });

      afterEach(() => e2e.flows.revertAllChanges());

      Array(repeat)
        .fill(0)
        .map((_, i) => {
          const testName = `${name}-${i}`;
          return it(testName, () => {
            e2e.flows.openDashboard();

            cy.wait(dashboard.delayAfterOpening);

            if (appStats) {
              const startCollecting = appStats.startCollecting;
              if (startCollecting) {
                cy.window().then((win) => startCollecting(win));
              }

              cy.startBenchmarking(testName);
              cy.wait(duration);

              cy.window().then((win) => {
                cy.stopBenchmarking(testName, appStats.collect(win));
              });
            } else {
              cy.startBenchmarking(testName);
              cy.wait(duration);
              cy.stopBenchmarking(testName, {});
            }
          });
        });
    });
  }
};
