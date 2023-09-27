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
  }

  describe(name, () => {
    before(() => {
      e2e.flows.login(e2e.env('USERNAME'), e2e.env('PASSWORD'));
    });

    beforeEach(() => {
      e2e.flows.importDashboards(dashboard.folder, 1000, dashboard.skipPanelValidation);
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

          e2e().wait(dashboard.delayAfterOpening);

          if (appStats) {
            const startCollecting = appStats.startCollecting;
            if (startCollecting) {
              e2e()
                .window()
                .then((win) => startCollecting(win));
            }

            e2e().startBenchmarking(testName);
            e2e().wait(duration);

            e2e()
              .window()
              .then((win) => {
                e2e().stopBenchmarking(testName, appStats.collect(win));
              });
          } else {
            e2e().startBenchmarking(testName);
            e2e().wait(duration);
            e2e().stopBenchmarking(testName, {});
          }
        });
      });
  });
};
