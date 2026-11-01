import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

interface BenchmarkOptions {
  rootDir: string;
  environment?: 'jsdom' | 'happy-dom';
  shard?: string;
  listTests?: boolean;
  timeoutMs?: number;
}

// These files split existing coverage; Jest hashes their paths independently when sharding.
const splitSuites = [
  ['public/app/features/inspector/utils/download.test.ts', 'public/app/features/inspector/utils/download.jsdom.test.ts'],
  ['public/app/plugins/panel/annolist/AnnoListPanel.test.tsx', 'public/app/plugins/panel/annolist/AnnoListPanel.jsdom.test.tsx'],
  ['public/swagger/schemaAnnotations.test.ts', 'public/swagger/schemaAnnotations.jsdom.test.ts'],
];

export function includeSplitSuites(rootDir: string, files: string[]): string[] {
  const selected = new Set(files.map((file) => path.resolve(rootDir, file)));
  for (const pair of splitSuites) {
    const absolute = pair.map((file) => path.resolve(rootDir, file));
    if (absolute.some((file) => selected.has(file))) {
      for (const file of absolute) {
        selected.add(file);
      }
    }
  }
  return [...selected].sort();
}

function parseEnvironment(environment: string): 'jsdom' | 'happy-dom' {
  if (environment !== 'jsdom' && environment !== 'happy-dom') {
    throw new Error(`Invalid environment ${JSON.stringify(environment)}. Expected jsdom or happy-dom.`);
  }
  return environment;
}

function validateShard(shard: string): void {
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
  rootDir,
  environment = 'jsdom',
  shard = '5/8',
  listTests = false,
  timeoutMs = 30 * 60 * 1000,
}: BenchmarkOptions): Promise<number> {
  validateShard(shard);
  const jestEnvironment =
    parseEnvironment(environment) === 'jsdom' ? 'jsdom' : path.resolve(rootDir, 'public/test/happy-dom-environment.js');
  const require = createRequire(path.join(rootDir, 'package.json'));
  const jest = require.resolve('jest/bin/jest');
  const cacheDirectory = await mkdtemp(path.join(tmpdir(), 'grafana-jest-benchmark-'));
  const commonArgs = [
    jest,
    '--config',
    path.join(rootDir, 'jest.config.js'),
    `--env=${jestEnvironment}`,
    '--ci',
    '--watch=false',
    '--watchAll=false',
    '--maxWorkers=4',
  ];
  const started = performance.now();
  console.log(`${environment} | shard ${shard} + split companions | 4 workers | cold Jest cache | Node ${process.version}`);

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

  const runJest = async (args: string[], captureOutput = false) => {
    if (stoppedCode !== undefined) {
      return { code: stoppedCode, stdout: '' };
    }
    child = spawn(process.execPath, [...commonArgs, ...args], {
      cwd: rootDir,
      env: { ...process.env, CI: 'true' },
      stdio: ['inherit', captureOutput ? 'pipe' : 'inherit', 'inherit'],
      // A separate process group lets cancellation stop Jest workers as well as the coordinator.
      detached: process.platform !== 'win32',
    });
    let stdout = '';
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    const code = await new Promise<number>((resolve, reject) => {
      child!.once('error', reject);
      child!.once('close', (exitCode) => resolve(exitCode ?? 1));
    });
    if (stoppedCode !== undefined) {
      kill('SIGKILL');
    }
    child = undefined;
    return { code: stoppedCode ?? code, stdout };
  };

  try {
    // Discovery must not populate the cache used by the measured test execution.
    const discoveryCache = path.join(cacheDirectory, 'discovery');
    const executionCache = path.join(cacheDirectory, 'execution');
    await mkdir(discoveryCache);
    const discovery = await runJest(
      ['--cacheDirectory', discoveryCache, `--shard=${shard}`, '--listTests', '--json'],
      true
    );
    if (discovery.code !== 0) {
      console.error(`Jest discovery failed with exit ${discovery.code}.`);
      return discovery.code;
    }
    const discovered: unknown = JSON.parse(discovery.stdout);
    if (!Array.isArray(discovered) || !discovered.length || !discovered.every((file) => typeof file === 'string')) {
      throw new Error('Jest discovery did not return a nonempty array of test paths.');
    }
    const files = includeSplitSuites(rootDir, discovered);
    await Promise.all(files.map((file) => access(file)));
    const relative = files.map((file) => path.relative(rootDir, file).split(path.sep).join('/')).sort();
    const hash = createHash('sha256').update(JSON.stringify(relative)).digest('hex');
    console.log(`Selected ${discovered.length} shard suites + ${files.length - discovered.length} split companions.`);
    console.log(`Selection SHA-256: ${hash}`);
    if (listTests) {
      console.log(relative.join('\n'));
      return stoppedCode ?? 0;
    }

    await mkdir(executionCache);
    const executionStarted = performance.now();
    const result = await runJest(['--cacheDirectory', executionCache, '--runTestsByPath', ...files]);
    console.log(
      `Jest execution: ${((performance.now() - executionStarted) / 1000).toFixed(2)}s | ` +
        `total including discovery: ${((performance.now() - started) / 1000).toFixed(2)}s | exit ${result.code}`
    );
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
        shard: { type: 'string', default: '5/8' },
      },
    });
    process.exitCode = await runBenchmark({
      rootDir: fileURLToPath(new URL('../', import.meta.url)),
      environment: parseEnvironment(values.environment),
      shard: values.shard,
      listTests: values.listTests,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
