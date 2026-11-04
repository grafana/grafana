#!/usr/bin/env node
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { createRequire } = require('node:module');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { parseArgs } = require('node:util');
const { createGzip } = require('node:zlib');
const { formatReport, summarizeCpu, formatCpu } = require('./jest-profile/report.cjs');
const { resolveTransform } = require('./jest-profile/swc-config.cjs');

const defaultSuite = 'public/app/features/alerting/unified/components/receivers/form/GrafanaReceiverForm.test.tsx';

function positiveInteger(value, name) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`${name} must be a positive integer.`);
  return Number(value);
}

async function runChild(command, args, options, logFile, timeoutMs) {
  const log = fs.createWriteStream(logFile);
  const child = spawn(command, args, { ...options, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  const started = performance.now();
  let stopped;
  let forceTimer;
  const kill = (signal) => {
    if (!child.pid) return;
    try {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  };
  const stop = (reason, code) => {
    if (stopped) return;
    stopped = { reason, code };
    console.error(reason);
    kill('SIGTERM');
    forceTimer = setTimeout(() => kill('SIGKILL'), 5000);
  };
  const interrupt = () => stop('Profiling interrupted.', 130);
  const terminate = () => stop('Profiling terminated.', 143);
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  const timer = setTimeout(() => stop(`Suite exceeded ${timeoutMs / 1000} seconds.`, 124), timeoutMs);
  child.stdout.on('data', (chunk) => { process.stdout.write(chunk); log.write(chunk); });
  child.stderr.on('data', (chunk) => { process.stderr.write(chunk); log.write(chunk); });
  try {
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code) => resolve(code ?? 1));
    });
    return { code: stopped?.code ?? code, stopped: Boolean(stopped), wallMs: performance.now() - started };
  } finally {
    clearTimeout(timer);
    clearTimeout(forceTimer);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
    if (stopped) kill('SIGKILL');
    await new Promise((resolve, reject) => { log.once('error', reject); log.end(resolve); });
  }
}

async function runProfile({ rootDir, suite = defaultSuite, output, cpu = false, heapMb, timeoutSeconds = 180, transformer = 'ts-jest', swcJest, sucraseJest, coldOnly = false }) {
  const file = path.resolve(rootDir, suite);
  const source = await fsp.readFile(file, 'utf8');
  if (/@jest-environment\s+\S+/.test(source.slice(0, 8192))) {
    throw new Error('Suite environment docblocks override the profiler. Select a suite without an environment override.');
  }
  const require = createRequire(path.join(rootDir, 'package.json'));
  const jest = require.resolve('jest/bin/jest');
  const transform = resolveTransform(rootDir, transformer, swcJest, sucraseJest);
  const parent = path.resolve(rootDir, output ?? 'local/jest-dom-bench/profiles');
  await fsp.mkdir(parent, { recursive: true });
  const directory = await fsp.mkdtemp(path.join(parent, 'suite-'));
  const cache = path.join(directory, 'cache');
  if (transformer === 'swc-mutable') {
    // Include WASM compilation in the cold run rather than reuse SWC's default disk cache.
    for (const [, options] of Object.values(transform.overrides.transform)) {
      options.jsc.experimental.cacheRoot = path.join(cache, 'swc-plugins');
    }
  }
  const configPath = path.join(directory, 'jest.config.cjs');
  const instrument = path.join(__dirname, 'jest-profile/instrument.cjs');
  const environment = path.join(__dirname, 'jest-profile/environment.cjs');
  // workerIdleMemoryLimit can force a child worker even with --runInBand, profiling the idle coordinator instead.
  await fsp.writeFile(configPath, `module.exports = { ...require(${JSON.stringify(path.join(rootDir, 'jest.config.js'))}), rootDir: ${JSON.stringify(rootDir)}, cacheDirectory: ${JSON.stringify(cache)}, testEnvironment: ${JSON.stringify(environment)}, workerIdleMemoryLimit: undefined, watchPlugins: [], ...${JSON.stringify(transform.overrides)} };\n`);
  const revision = spawnSync('git', ['--no-pager', 'rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8' }).stdout?.trim();
  const metadata = { suite: file, revision, transformer: transform.metadata, coldOnly, node: process.version, cpu, cpuSampleIntervalUs: cpu ? 4000 : undefined, heapMb: heapMb ?? 'Node default', timeoutSeconds, nodeOptions: process.env.NODE_OPTIONS ?? '', runs: {} };
  console.log(`Happy DOM | ${path.relative(rootDir, file)} | ${transformer} | ${coldOnly ? 'cold cache only' : 'sequential cold/warm fresh processes'}`);
  console.log(`Heap: ${heapMb ? `${heapMb} MiB` : 'Node default'} | CPU sampling: ${cpu ? '4 ms' : 'off'} | artifacts: ${directory}`);
  console.log('This is an isolated-suite diagnostic, not a four-worker shard benchmark.');
  let exitCode = 0;
  try {
    for (const mode of coldOnly ? ['cold'] : ['cold', 'warm']) {
      const disk = await fsp.statfs(directory);
      const required = (cpu ? 256 : 128) * 1024 ** 2;
      if (disk.bavail * disk.bsize < required) throw new Error(`Not enough disk space for ${mode}: need ${required / 1024 ** 2} MiB free.`);
      const run = path.join(directory, mode);
      const args = [
        ...(heapMb ? [`--max-old-space-size=${heapMb}`] : []),
        ...(cpu ? ['--cpu-prof', '--cpu-prof-interval=4000', `--cpu-prof-dir=${directory}`, `--cpu-prof-name=${mode}.cpuprofile`] : []),
        `--require=${instrument}`, jest, '--config', configPath, '--ci', '--watch=false', '--watchAll=false', '--runInBand',
        '--json', `--outputFile=${run}.results.json`, '--runTestsByPath', file,
      ];
      const result = await runChild(process.execPath, args, {
        cwd: rootDir,
        env: { ...process.env, CI: 'true', GRAFANA_JEST_PROFILE_ROOT: rootDir, GRAFANA_JEST_PROFILE_RUN: run, GRAFANA_JEST_PROFILE_SUITE: file },
      }, `${run}.log`, timeoutSeconds * 1000);
      exitCode ||= result.code;
      const entry = { ...result, args };
      metadata.runs[mode] = entry;
      if (fs.existsSync(`${run}.results.json`)) {
        const results = JSON.parse(await fsp.readFile(`${run}.results.json`, 'utf8'));
        entry.tests = { passed: results.numPassedTests, failed: results.numFailedTests, skipped: results.numPendingTests, todo: results.numTodoTests };
      }
      if (fs.existsSync(`${run}.attribution.json`)) {
        const data = JSON.parse(await fsp.readFile(`${run}.attribution.json`, 'utf8'));
        const report = formatReport(mode, data, result.wallMs, result);
        if (fs.existsSync(`${run}.cpuprofile`)) {
          entry.cpuSamples = summarizeCpu(JSON.parse(await fsp.readFile(`${run}.cpuprofile`, 'utf8')), data);
          report.text += formatCpu(entry.cpuSamples);
        }
        entry.summary = report.summary;
        if (!report.summary.complete) exitCode ||= 1;
        await fsp.writeFile(`${run}.report.txt`, report.text);
        console.log(report.text);
      } else {
        console.error(`No attribution file for ${mode}. See ${run}.log. A killed process cannot flush its trace.`);
        exitCode ||= 1;
      }
      const profile = `${run}.cpuprofile`;
      if (fs.existsSync(profile)) {
        await pipeline(fs.createReadStream(profile), createGzip(), fs.createWriteStream(`${profile}.gz`));
        await fsp.unlink(profile);
      }
      if (result.stopped) break;
    }
  } finally {
    await fsp.writeFile(path.join(directory, 'run.json'), JSON.stringify(metadata, null, 2) + '\n');
    await fsp.rm(cache, { recursive: true, force: true });
  }
  if (exitCode) console.error('At least one run failed or stopped. Treat these reports as diagnostics, not a successful benchmark.');
  const cold = metadata.runs.cold?.summary;
  const warm = metadata.runs.warm?.summary;
  if (cold && warm && cold.matcherCalls !== warm.matcherCalls) {
    console.error(`Matcher counts differ: cold ${cold.matcherCalls}, warm ${warm.matcherCalls}. Inspect failures and conditional assertions before comparing timing.`);
  }
  console.log(`Reports: ${directory}`);
  console.log('Lifecycle totals and cost buckets are two views of the same time. Do not add them together.');
  console.log('Transformer process is actual transformation work; transform pipeline excludes nested process/cache-key time in the cost buckets.');
  console.log('Module self time includes Jest execution/loading overhead. Other includes uninstrumented work, native module loads, test execution and waits.');
  console.log('Cold/warm differences include cache effects and run variation; they are not a direct forecast for a replacement transformer.');
  return exitCode;
}

module.exports = { runProfile, runChild, positiveInteger };

if (require.main === module) {
  (async () => {
    const { values } = parseArgs({ options: {
      suite: { type: 'string', default: defaultSuite }, output: { type: 'string' }, cpu: { type: 'boolean', default: false },
      transformer: { type: 'string', default: 'ts-jest' }, 'swc-jest': { type: 'string' }, 'sucrase-jest': { type: 'string' }, 'cold-only': { type: 'boolean', default: false },
      'heap-mb': { type: 'string' }, 'timeout-seconds': { type: 'string', default: '180' }, help: { type: 'boolean', default: false },
    } });
    if (values.help) {
      console.log('node scripts/jest-profile.cjs [--cpu] [--suite=path] [--heap-mb=768] [--timeout-seconds=180] [--output=directory] [--cold-only] [--transformer=ts-jest|swc|swc-mutable|sucrase] [--swc-jest=adapter-directory] [--sucrase-jest=adapter-directory]\nRuns the slowest suite from the supplied shard-1 log by default, not automatic shard discovery.\nRuns a cold/warm pair in Happy DOM, or a single cold run with --cold-only. No dependencies are installed; the normal Jest cache is untouched.');
      return;
    }
    process.exitCode = await runProfile({
      rootDir: path.resolve(__dirname, '..'), suite: values.suite, output: values.output, cpu: values.cpu,
      transformer: values.transformer, swcJest: values['swc-jest'], sucraseJest: values['sucrase-jest'], coldOnly: values['cold-only'],
      heapMb: values['heap-mb'] === undefined ? undefined : positiveInteger(values['heap-mb'], '--heap-mb'),
      timeoutSeconds: positiveInteger(values['timeout-seconds'], '--timeout-seconds'),
    });
  })().catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
}
