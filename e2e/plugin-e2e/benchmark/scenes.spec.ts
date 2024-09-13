import {
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
} from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { expect, PluginFixture, PluginOptions, test } from '@grafana/plugin-e2e';
import { SceneInteractionProfileEvent } from '@grafana/scenes';

import { formatExpectError } from '../plugin-e2e-api-tests/errors';

type TestContext = Pick<
  PlaywrightTestArgs &
    PlaywrightTestOptions &
    PluginFixture &
    PlaywrightWorkerArgs &
    PlaywrightWorkerOptions &
    PluginOptions,
  'page' | 'createDataSourceConfigPage' | 'gotoDashboardPage'
>;

const RUNS = 2;

test.use({
  featureToggles: {
    dashboardScene: true,
  },
});

test('dashboard with a single panel', async ({ createDataSourceConfigPage, page, gotoDashboardPage }) => {
  const fileName = 'benchmark-single-query.csv';
  const testContext = { createDataSourceConfigPage, page, gotoDashboardPage };

  const dash = await setupBenchmark(testContext, 'cdt8wrar2blkwe/benchmark3a-single-query');
  await runBenchmarkInteraction(fileName, RUNS, async () => {
    await dash.refreshDashboard();
  });

  await processBenchmarkResults(testContext, fileName);
  return;
});

test('dashboard with a single text panel', async ({ createDataSourceConfigPage, page, gotoDashboardPage }) => {
  const testContext = { createDataSourceConfigPage, page, gotoDashboardPage };
  const fileName = 'benchmark-single-text-panel.csv';

  const dash = await setupBenchmark(testContext, 'cdt8wrar2blkwf/benchmark3a-text-panel');

  await runBenchmarkInteraction(fileName, RUNS, async () => {
    await dash.refreshDashboard();
  });

  await processBenchmarkResults(testContext, fileName);
  return;
});

test('dashboard with a slow panel', async ({ createDataSourceConfigPage, page, gotoDashboardPage }) => {
  const testContext = { createDataSourceConfigPage, page, gotoDashboardPage };
  const fileName = 'benchmark-slow-query.csv';

  const dash = await setupBenchmark(testContext, 'ddt85qfrjpzpce/benchmark3a-slow-front-end-data-source', 5000);

  await runBenchmarkInteraction(
    fileName,
    RUNS,
    async () => {
      await dash.refreshDashboard();
    },
    3000
  );

  await processBenchmarkResults(testContext, fileName);
  return;
});

test('dashboard with a query variable and a single panel', async ({
  createDataSourceConfigPage,
  page,
  gotoDashboardPage,
}) => {
  const testContext = { createDataSourceConfigPage, page, gotoDashboardPage };
  const fileName = 'benchmarka-with-single-query-variable-and-panel.csv';

  const dash = await setupBenchmark(testContext, 'edt8433nfnzswe/benchmark3a-with-1-query-variable', 5000);

  await runBenchmarkInteraction(
    fileName,
    RUNS,
    async () => {
      await dash.refreshDashboard();
    },
    3000
  );
  await processBenchmarkResults(testContext, fileName);
  return;
});

async function setupBenchmark(context: TestContext, uid: string, sleep = 2500) {
  test.setTimeout(0);

  const configPage = await context.createDataSourceConfigPage({ type: 'prometheus' });
  await context.page.getByPlaceholder('http://localhost:9090').fill('https://prometheus.demo.do.prometheus.io');
  await expect(
    configPage.saveAndTest(),
    formatExpectError('Expected save data source config to fail when Prometheus server is not running')
  ).toBeOK();

  const d = await context.gotoDashboardPage({ uid });
  await wait(sleep); // Wait for 3 seconds before the next iteration
  return d;
}

async function runBenchmarkInteraction(
  name: string,
  runs: number = RUNS,
  interaction: () => Promise<void>,
  sleep = 2500
) {
  for (let i = 0; i < runs; i++) {
    console.log(`${name}: run ${i + 1}`);
    await interaction();
    await wait(sleep); // Wait for 3 seconds before the next iteration
  }
}

async function processBenchmarkResults(testContext: TestContext, fileName: string) {
  // @ts-ignore
  const echo = await testContext.page.evaluate(() => window.__grafanaEcho);

  const runs = echo.backends[0].buffer;
  await writeBenchmarkResults(fileName, runs);
}

async function writeBenchmarkResults(
  fileName: string,
  data: Array<SceneInteractionProfileEvent & { interactionType: string }>
) {
  return await new Promise((resolve, reject) => {
    let csv = 'run, duration, networkDuration, jsHeapSizeLimit, usedJSHeapSize, totalJSHeapSize, interactionType\n';
    const projectPath = process.env.CWD || process.cwd();
    const filePath = path.join(projectPath, 'benchmark-results', fileName);
    csv += data
      .map(
        (r, i) =>
          `${i + 1}, ${r.duration}, ${r.networkDuration}, ${r.jsHeapSizeLimit}, ${r.usedJSHeapSize}, ${r.totalJSHeapSize}, ${r.interactionType}`
      )
      .join('\n');

    const dir = path.dirname(filePath);

    // Check if the directory exists
    if (!fs.existsSync(dir)) {
      // Create the directory recursively
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, csv);
    resolve(null);
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
