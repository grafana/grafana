const fs = require('fs');
const { fromPairs } = require('lodash');

const { CDPDataCollector } = require('./CDPDataCollector');
const { formatResults } = require('./formatting');

const remoteDebuggingPortOptionPrefix = '--remote-debugging-port=';

const getOrAddRemoteDebuggingPort = (args) => {
  const existing = args.find((arg) => arg.startsWith(remoteDebuggingPortOptionPrefix));

  if (existing) {
    return Number(existing.substring(remoteDebuggingPortOptionPrefix.length));
  }

  const port = 40000 + Math.round(Math.random() * 25000);
  args.push(`${remoteDebuggingPortOptionPrefix}${port}`);
  return port;
};

let collectors = [];
let results = [];

const startBenchmarking = async ({ testName }) => {
  await Promise.all(collectors.map((coll) => coll.start({ id: testName })));

  return true;
};

const stopBenchmarking = async ({ testName, appStats }) => {
  const data = await Promise.all(collectors.map(async (coll) => [coll.getName(), await coll.stop({ id: testName })]));

  results.push({
    collectorsData: fromPairs(data),
    appStats: appStats,
  });

  return true;
};
const afterRun = async () => {
  await Promise.all(collectors.map((coll) => coll.close()));
  collectors = [];
  results = [];
};

const afterSpec = (resultsFolder) => async (spec) => {
  fs.writeFileSync(`${resultsFolder}/${spec.name}-${Date.now()}.json`, JSON.stringify(formatResults(results), null, 2));

  results = [];
};

const initialize = (on, config) => {
  const resultsFolder = config.env['BENCHMARK_PLUGIN_RESULTS_FOLDER'];

  if (!fs.existsSync(resultsFolder)) {
    fs.mkdirSync(resultsFolder, { recursive: true });
    console.log(`Created folder for benchmark results ${resultsFolder}`);
  }

  on('before:browser:launch', async (browser, options) => {
    if (browser.family !== 'chromium' || browser.name === 'electron') {
      throw new Error('benchmarking plugin requires chrome');
    }

    const { args } = options;

    const port = getOrAddRemoteDebuggingPort(args);
    collectors.push(new CDPDataCollector({ port }));

    args.push('--start-fullscreen');

    console.log(
      `initialized benchmarking plugin with ${collectors.length} collectors: ${collectors
        .map((col) => col.getName())
        .join(', ')}`
    );

    return options;
  });

  on('task', {
    startBenchmarking,
    stopBenchmarking,
  });

  on('after:run', afterRun);
  on('after:spec', afterSpec(resultsFolder));
};

exports.initialize = initialize;
