import { e2e } from '../';

export interface BenchmarkArguments {
  name: string;
  benchmarkingOptions: {
    dashboardFolder: string;
    repeat: number;
    delayAfterOpeningDashboard: number;
    duration: number;
    appStats?: {
      startCollecting?: (window: Window) => void;
      collect: (window: Window) => Record<string, unknown>;
    };
  };
  skipScenario?: boolean;
}

export const benchmark = ({
  name,
  skipScenario = false,
  benchmarkingOptions: { duration, delayAfterOpeningDashboard, repeat, dashboardFolder, appStats },
}: BenchmarkArguments) => {
  if (skipScenario) {
    describe(name, () => {
      it.skip(name, () => {});
    });
  }

  describe(name, () => {
    before(() => {
      e2e.flows.login(e2e.env('USERNAME'), e2e.env('PASSWORD'));
    });

    beforeEach(() => {
      e2e.flows.importDashboards(dashboardFolder, 1000);
      Cypress.Cookies.preserveOnce('grafana_session');
    });

    afterEach(() => e2e.flows.revertAllChanges());
    after(() => {
      e2e().clearCookies();
    });

    Array(repeat)
      .fill(0)
      .map((_, i) => {
        const testName = `${name}-${i}`;
        return it(testName, () => {
          e2e.flows.openDashboard();

          e2e().wait(delayAfterOpeningDashboard);

          if (appStats) {
            e2e()
              .window()
              .then((win) => {
                appStats.startCollecting?.(win);
                e2e().startBenchmarking(testName);
                e2e().wait(duration);
                e2e().stopBenchmarking(testName, appStats.collect(win));
              });
          } else {
            e2e().startBenchmarking(testName);
            e2e().wait(duration);
            e2e().stopBenchmarking(testName, {});
          }
        });
      });

    // @todo remove when possible: https://github.com/cypress-io/cypress/issues/2831
    it('temporary', () => {});
  });
};
