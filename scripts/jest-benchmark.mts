import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, stripVTControlCharacters } from 'node:util';

import { applyRoster, loadBenchmarkConfig } from './jest-benchmark-config.mts';
import { benchmarkMetadata, collectProcessMetrics, printMetrics } from './jest-benchmark-metrics.mts';
import { startRssSampler, type RssMetrics } from './jest-benchmark-rss.mts';


export function createBenchmarkStderrFilter(): Transform {
  const decoder = new StringDecoder('utf8');
  let pending = '';
  const compact = (line: string) =>
    /^Ran all test suites within paths(?:\s|$)/.test(stripVTControlCharacters(line))
      ? `Ran all selected test suites.${line.endsWith('\r\n') ? '\r\n' : line.endsWith('\n') ? '\n' : ''}`
      : line;

  // Jest can split its final path list across writes, including within ANSI escapes or UTF-8 characters.
  return new Transform({
    transform(chunk, _encoding, callback) {
      pending += decoder.write(chunk);
      let end: number;
      while ((end = pending.indexOf('\n')) !== -1) {
        this.push(compact(pending.slice(0, end + 1)));
        pending = pending.slice(end + 1);
      }
      callback();
    },
    flush(callback) {
      this.push(compact(pending + decoder.end()));
      callback();
    },
  });
}

interface BenchmarkOptions {
  // Fixture tests inject a root; the CLI always uses the checkout containing this runner.
  rootDir?: string;
  environment?: 'jsdom' | 'happy-dom';
  shard?: string;
  listTests?: boolean;
  outputFile?: string;
  metricsFile?: string;
  selectionFile?: string;
  noGc?: boolean;
  noMetrics?: boolean;

  timeoutMs?: number;
}


async function readSelection(rootDir: string, file: string, shard: string): Promise<string[]> {
  const report = JSON.parse(await readFile(path.resolve(rootDir, file), 'utf8'));
  if (report?.schemaVersion !== 1 || report.shard !== shard) {
    throw new Error('--selectionFile must be a benchmark metrics report for the requested shard.');
  }
  const files: unknown = report.selectedSuites;
  if (!Array.isArray(files) || !files.length || !files.every((file) => typeof file === 'string' && file.length > 0)) {
    throw new Error('--selectionFile must contain a nonempty selectedSuites array of relative paths.');
  }
  return files.map((file: string) => {
    const relative = path.relative(rootDir, path.resolve(rootDir, file));
    if (path.isAbsolute(file) || path.win32.isAbsolute(file) || relative === '..' || relative.startsWith(`..${path.sep}`)) {
      throw new Error(`Selection path must stay inside rootDir: ${JSON.stringify(file)}`);
    }
    return path.resolve(rootDir, file);
  });
}

function parseEnvironment(environment: string): 'jsdom' | 'happy-dom' {
  if (environment !== 'jsdom' && environment !== 'happy-dom') {
    throw new Error(`Invalid environment ${JSON.stringify(environment)}. Expected jsdom or happy-dom.`);
  }
  return environment;
}

function validateShard(shard: string | undefined): asserts shard is string {
  if (shard === undefined) {
    throw new Error('Missing required --shard option. Example: --shard=5/8.');
  }
  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(shard);
  const index = Number(match?.[1]);
  const count = Number(match?.[2]);
  if (match?.[0] !== shard || !Number.isSafeInteger(index) || !Number.isSafeInteger(count) || index > count) {
    throw new Error(
      `Invalid shard ${JSON.stringify(shard)}. Expected N/M with positive safe integers, no leading zeros, and N <= M.`
    );
  }
}

export async function runBenchmark({
  rootDir = fileURLToPath(new URL('../', import.meta.url)),
  environment = 'jsdom',
  shard,
  listTests = false,
  outputFile,
  metricsFile,
  selectionFile,
  noGc = false,
  noMetrics = false,

  timeoutMs = 30 * 60 * 1000,
}: BenchmarkOptions = {}): Promise<number> {
  validateShard(shard);
  rootDir = path.resolve(rootDir);
  const gc = !noGc && !noMetrics;
  if (
    outputFile !== undefined &&
    metricsFile !== undefined &&
    path.resolve(rootDir, outputFile) === path.resolve(rootDir, metricsFile)
  ) {
    throw new Error('--metricsFile and --outputFile must use different paths.');
  }
  if (
    selectionFile !== undefined &&
    [outputFile, metricsFile].some((file) => file !== undefined && path.resolve(rootDir, file) === path.resolve(rootDir, selectionFile))
  ) {
    throw new Error('Output paths must not overwrite --selectionFile.');
  }
  const config = await loadBenchmarkConfig(rootDir, parseEnvironment(environment), shard);
  const jestEnvironment = config.testEnvironment.startsWith('./')
    ? path.resolve(rootDir, config.testEnvironment)
    : config.testEnvironment;
  const require = createRequire(path.join(rootDir, 'package.json'));
  const jest = require.resolve('jest/bin/jest');
  const configFile = config.jestConfig;

  const cacheDirectory = await mkdtemp(path.join(tmpdir(), 'grafana-jest-benchmark-'));
  const commonArgs = [
    jest,
    '--config',
    path.join(rootDir, configFile),
    `--env=${jestEnvironment}`,
    '--ci',
    '--watch=false',
    '--watchAll=false',
    '--maxWorkers=4',

  ];
  const started = performance.now();
  console.log(
    `${environment} | shard ${shard} | 4 workers | cold Jest cache | Node ${process.version}`
  );

  let child: ChildProcess | undefined;
  let stoppedCode: number | undefined;
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const kill = (signal: NodeJS.Signals) => {
    if (!child?.pid) {
      return;
    }
    try {
      if (process.platform === 'win32') {
        // Windows has no POSIX process groups; stop the tree before its coordinator exits.
        const result = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        if (result.error) {
          throw result.error;
        }
      } else {
        process.kill(-child.pid, signal);
      }
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) {
        throw error;
      }
    }
  };
  const stop = (code: number, message: string) => {
    if (stoppedCode !== undefined) {
      return;
    }
    stoppedCode = code;
    console.error(message);
    kill('SIGTERM');
    killTimer = setTimeout(() => kill('SIGKILL'), 5000);
  };
  const interrupt = () => stop(130, 'Benchmark interrupted.');
  const terminate = () => stop(143, 'Benchmark terminated.');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  const timeout = setTimeout(() => stop(124, `Benchmark exceeded ${timeoutMs / 1000} seconds.`), timeoutMs);

  const processDirectory = path.join(cacheDirectory, 'process-metrics');
  const runJest = async (args: string[], captureOutput = false, measure = false) => {
    if (stoppedCode !== undefined) {
      return { code: stoppedCode, stdout: '', executionMs: 0, rss: null };
    }
    const env: NodeJS.ProcessEnv = { ...process.env, CI: 'true' };
    // The output filter pipes stderr, so Jest cannot detect the original terminal's colors.
    if (
      measure && process.stderr.isTTY &&
      env.FORCE_COLOR === undefined && env.NO_COLOR === undefined && env.NODE_DISABLE_COLORS === undefined
    ) {
      const depth = process.stderr.getColorDepth();
      if (depth >= 4) {
        env.FORCE_COLOR = depth >= 24 ? '3' : depth >= 8 ? '2' : '1';
      }
    }
    if (measure && !noMetrics) {
      const preload = fileURLToPath(new URL('./jest-benchmark-process.cjs', import.meta.url));
      Object.assign(env, {
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require ${JSON.stringify(preload)}`.trim(),
        GRAFANA_BENCHMARK_METRICS_DIR: processDirectory,
        GRAFANA_BENCHMARK_JEST_ENTRY: jest,
        GRAFANA_BENCHMARK_GC: gc ? '1' : '0',
      });
    }
    const executionStarted = performance.now();
    child = spawn(process.execPath, [...commonArgs, ...args], {
      cwd: rootDir,
      env,
      stdio: ['inherit', captureOutput ? 'pipe' : 'inherit', measure ? 'pipe' : 'inherit'],
      // A separate process group lets cancellation stop Jest workers as well as the coordinator.
      detached: process.platform !== 'win32',
    });
    if (measure) {
      child.stderr?.pipe(createBenchmarkStderrFilter()).pipe(process.stderr, { end: false });
    }
    let stdout = '';
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    const sampler = measure && !noMetrics && child.pid ? startRssSampler(child.pid) : undefined;
    let code: number;
    let rss: RssMetrics | null = null;
    let executionMs: number;
    try {
      code = await new Promise<number>((resolve, reject) => {
        child!.once('error', reject);
        child!.once('close', (exitCode) => resolve(exitCode ?? 1));
      });
    } finally {
      executionMs = performance.now() - executionStarted;
      rss = sampler ? await sampler.stop() : null;
    }
    if (stoppedCode !== undefined) {
      kill('SIGKILL');
    }
    child = undefined;
    return { code: stoppedCode ?? code, stdout, executionMs, rss };
  };

  try {
    // Discovery must not populate the cache used by the measured test execution.
    const discoveryCache = path.join(cacheDirectory, 'discovery');
    const executionCache = path.join(cacheDirectory, 'execution');
    let discovered: unknown;
    if (selectionFile !== undefined) {
      discovered = await readSelection(rootDir, selectionFile, shard);
    } else {
      await mkdir(discoveryCache);
      const discovery = await runJest(
        ['--cacheDirectory', discoveryCache, `--shard=${shard}`, '--listTests', '--json'],
        true
      );
      if (discovery.code !== 0) {
        console.error(`Jest discovery failed with exit ${discovery.code}.`);
        return discovery.code;
      }
      discovered = JSON.parse(discovery.stdout);
    }
    if (!Array.isArray(discovered) || !discovered.length || !discovered.every((file) => typeof file === 'string')) {
      throw new Error('Jest discovery did not return a nonempty array of test paths.');
    }
    let candidates = discovered;
    if (selectionFile !== undefined || config.roster.include.length || config.roster.groups.length) {
      await mkdir(discoveryCache, { recursive: true });
      const inventory = await runJest(['--cacheDirectory', discoveryCache, '--listTests', '--json'], true);
      if (inventory.code !== 0) {
        console.error(`Jest roster discovery failed with exit ${inventory.code}.`);
        return inventory.code;
      }
      const parsed: unknown = JSON.parse(inventory.stdout);
      if (!Array.isArray(parsed) || !parsed.every((file) => typeof file === 'string')) {
        throw new Error('Jest roster discovery did not return an array of test paths.');
      }
      candidates = parsed;
    }
    const roster = applyRoster(rootDir, discovered, candidates, config.roster);
    const { files } = roster;
    if (!files.length) {
      throw new Error('Benchmark roster is empty after applying JSON configuration.');
    }
    if (selectionFile !== undefined) {
      const eligible = new Set(candidates);
      const unavailable = files.filter((file) => !eligible.has(file));
      if (unavailable.length) {
        throw new Error(`Selected tests are unavailable in the Jest inventory: ${unavailable.map((file) => path.relative(rootDir, file)).join(', ')}`);
      }
    }
    await Promise.all(files.map((file) => access(file)));
    const relative = files.map((file) => path.relative(rootDir, file).split(path.sep).join('/')).sort();
    const hash = createHash('sha256').update(JSON.stringify(relative)).digest('hex');
    console.log(`Roster config: ${config.files.map((file) => file.path).join(', ') || 'none'}`);
    console.log(
      `Selected ${discovered.length} ${selectionFile === undefined ? 'shard' : 'baseline'} suites + ${roster.added.length} additions - ${roster.excluded.length} exclusions = ${files.length} suites.`
    );
    console.log(`Selection SHA-256: ${hash}`);
    if (listTests) {
      console.log(relative.join('\n'));
      return stoppedCode ?? 0;
    }

    const metadata = await benchmarkMetadata(rootDir, configFile);
    console.log(
      `Checkout: ${rootDir} | revision ${metadata.revision ?? 'unknown'}${metadata.trackedChanges ? ' (tracked changes)' : ''}`
    );
    await mkdir(executionCache);
    if (!noMetrics) {
      await mkdir(processDirectory);
    }
    const startedAt = new Date().toISOString();
    const result = await runJest(
      [
        '--cacheDirectory',
        executionCache,
        ...(outputFile === undefined ? [] : ['--json', '--outputFile', path.resolve(rootDir, outputFile)]),
        '--runTestsByPath',
        ...files,
      ],
      false,
      true
    );
    const totalMs = performance.now() - started;
    const processes = noMetrics ? null : await collectProcessMetrics(processDirectory, gc);
    printMetrics({
      executionMs: result.executionMs,
      totalMs,
      exitCode: result.code,
      metricsEnabled: !noMetrics,
      rss: result.rss,
      processes,
    });
    if (metricsFile !== undefined) {
      const destination = path.resolve(rootDir, metricsFile);
      const report = {
        schemaVersion: 1,
        rootDir,
        startedAt,
        ...metadata,
        environment,
        configFile,
        shard,
        maxWorkers: 4,
        coldJestCache: true,

        testEnvironment: jestEnvironment,
        rosterConfig: {
          files: config.files,
          rules: config.roster,
          added: roster.added.map((file) => path.relative(rootDir, file).split(path.sep).join('/')),
          excluded: roster.excluded.map((file) => path.relative(rootDir, file).split(path.sep).join('/')),
        },
        selectedSuiteCount: files.length,
        selectionHash: hash,
        selectionSource: selectionFile === undefined ? 'shard' : path.resolve(rootDir, selectionFile),
        selectedSuites: relative,
        gcEnabled: gc,
        metricsEnabled: !noMetrics,
        executionMs: result.executionMs,
        totalMs,
        exitCode: result.code,
        rss: result.rss,
        processes,
      };
      try {
        await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`);
        console.log(`Benchmark metrics: ${destination}`);
      } catch (error) {
        console.error(`Could not write benchmark metrics: ${String(error)}`);
        return result.code || 1;
      }
    }
    return result.code;
  } finally {
    clearTimeout(timeout);
    clearTimeout(killTimer);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
    if (stoppedCode !== undefined) {
      kill('SIGKILL');
    }
    try {
      await rm(cacheDirectory, { recursive: true, force: true });
    } catch (error) {
      console.error(`Could not remove benchmark cache ${cacheDirectory}:`, error);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({
      options: {
        listTests: { type: 'boolean', default: false },
        environment: { type: 'string', default: 'jsdom' },
        shard: { type: 'string' },
        outputFile: { type: 'string' },
        metricsFile: { type: 'string' },
        selectionFile: { type: 'string' },

        noGc: { type: 'boolean', default: false },
        noMetrics: { type: 'boolean', default: false },

      },
    });
    process.exitCode = await runBenchmark({

      environment: parseEnvironment(values.environment),
      shard: values.shard,
      listTests: values.listTests,
      outputFile: values.outputFile,
      metricsFile: values.metricsFile,
      selectionFile: values.selectionFile,
      noGc: values.noGc,
      noMetrics: values.noMetrics,

    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
