import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import { readBundleSizes } from './bundleMetrics/bundleSizes.mts';
import { readRsdoctorMetrics } from './bundleMetrics/rsdoctor.mts';

const cliPath = fileURLToPath(new URL('./reportBundleMetrics.mts', import.meta.url));

const legacySizeOutput =
  'default.entrypoints.app.js 21\n' +
  'default.entrypoints.app.css 5\n' +
  'default.entrypoints.admin.js 18\n' +
  'default.entrypoints.admin.css 14\n';

const bundleSizeOutput =
  'bundleSize.default.entrypoints.app.js 21\n' +
  'bundleSize.default.entrypoints.app.css 5\n' +
  'bundleSize.default.entrypoints.admin.js 18\n' +
  'bundleSize.default.entrypoints.admin.css 14\n';

const rspackBundleSizeOutput =
  'bundleSize.rspack.entrypoints.app.js 42\n' +
  'bundleSize.rspack.entrypoints.app.css 12\n' +
  'bundleSize.rspack.entrypoints.admin.js 44\n' +
  'bundleSize.rspack.entrypoints.admin.css 28\n';

const rsdoctorMetrics = {
  initialChunks: 2,
  asyncChunks: 1,
  largestAsyncJsBytes: 500,
  'entrypoints.app.js.bytes': 130,
  'entrypoints.app.js.gzipBytes': 65,
  'entrypoints.app.css.bytes': 20,
  'entrypoints.app.css.gzipBytes': 10,
  initialModules: 4,
  totalModules: 5,
  asyncOnlyModules: 1,
  'dependencies.staticImports': 2,
  'dependencies.dynamicImports': 1,
  'dependencies.requireCalls': 1,
  'dependencies.amdRequires': 0,
  'dependencies.unknown': 1,
  compileMs: 13,
  loaderInvocations: 2,
  loaderCumulativeMs: 16,
  compilerWarnings: 1,
  rsdoctorWarnings: 1,
};

async function writeReport(profileDirectory, report) {
  const data = {};

  for (const [field, value] of Object.entries(report)) {
    if (value === undefined) {
      continue;
    }

    const encoded = deflateSync(JSON.stringify(value)).toString('base64');
    const splitAt = Math.ceil(encoded.length / 2);
    const shards = [encoded.slice(0, splitAt), encoded.slice(splitAt)];
    const producerDirectory = join('/producer-machine/rsdoctor-report', field);

    data[field] = shards.map((_, index) => join(producerDirectory, String(index)));
    await mkdir(join(profileDirectory, field), { recursive: true });
    await Promise.all(
      shards.map((shard, index) => writeFile(join(profileDirectory, field, String(index)), shard, 'utf8'))
    );
  }

  await mkdir(profileDirectory, { recursive: true });
  await writeFile(join(profileDirectory, 'manifest.json'), JSON.stringify({ data }), 'utf8');
}

async function writeAsset(buildDirectory, assetPath, contents) {
  const filePath = join(buildDirectory, assetPath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, 'utf8');
}

async function createBuildFixture(t, { includeRspack = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'bundle-metrics-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  await Promise.all([
    writeAsset(directory, 'runtime.js', 'RUNTIME'),
    writeAsset(directory, 'shared/vendor.js', 'VENDOR'),
    writeAsset(directory, 'app.js', 'APP-CODE'),
    writeAsset(directory, 'admin.js', 'ADMIN'),
    writeAsset(directory, 'shared/theme.css', 'THEME'),
    writeAsset(directory, 'admin.css', 'ADMIN-CSS'),
  ]);
  await writeFile(
    join(directory, 'assets-manifest.json'),
    JSON.stringify({
      entrypoints: {
        app: {
          assets: {
            js: [
              'public/build/runtime.js',
              'public/build/shared/vendor.js',
              'public/build/app.js',
              'public/build/shared/vendor.js',
            ],
            css: ['public/build/shared/theme.css'],
          },
        },
        admin: {
          assets: {
            js: ['public/build/runtime.js', 'public/build/shared/vendor.js', 'public/build/admin.js'],
            css: ['public/build/shared/theme.css', 'public/build/admin.css'],
          },
        },
      },
    }),
    'utf8'
  );

  if (includeRspack) {
    await writeRspackFixture(directory);
  }

  return directory;
}

async function writeRspackFixture(buildDirectory) {
  await Promise.all([
    writeAsset(buildDirectory, 'rspack/runtime.js', 'RSPACK-RUNTIME'),
    writeAsset(buildDirectory, 'rspack/shared/vendor.js', 'RSPACK-VENDOR'),
    writeAsset(buildDirectory, 'rspack/app.js', 'RSPACK-APP-CODE'),
    writeAsset(buildDirectory, 'rspack/admin.js', 'RSPACK-ADMIN-CODE'),
    writeAsset(buildDirectory, 'rspack/shared/theme.css', 'RSPACK-THEME'),
    writeAsset(buildDirectory, 'rspack/admin.css', 'RSPACK-ADMIN-CSS'),
  ]);
  await writeFile(
    join(buildDirectory, 'rspack', 'assets-manifest.json'),
    JSON.stringify({
      entrypoints: {
        esModule: true,
        app: {
          assets: {
            js: [
              'public/build/rspack/runtime.js',
              'public/build/rspack/shared/vendor.js',
              'public/build/rspack/app.js',
              'public/build/rspack/shared/vendor.js',
            ],
            css: ['public/build/rspack/shared/theme.css'],
          },
        },
        admin: {
          assets: {
            js: [
              'public/build/rspack/runtime.js',
              'public/build/rspack/shared/vendor.js',
              'public/build/rspack/admin.js',
            ],
            css: ['public/build/rspack/shared/theme.css', 'public/build/rspack/admin.css'],
          },
        },
      },
    }),
    'utf8'
  );
}

function rsdoctorReport() {
  return {
    chunkGraph: {
      chunks: [
        { id: 'main', initial: true, modules: [1, 2, 5, 6], assets: ['app.js', 'app.css'] },
        { id: 'vendor', initial: true, modules: [1, 2], assets: ['vendor.js'] },
        { id: 'lazy', initial: false, modules: [4], assets: ['lazy.js'] },
      ],
      assets: [
        { path: 'app.js', size: 100, gzipSize: 50 },
        { path: 'vendor.js', size: 30, gzipSize: 15 },
        { path: 'app.css', size: 20, gzipSize: 10 },
        { path: 'lazy.js', size: 500, gzipSize: 200 },
      ],
      entrypoints: [{ name: 'app', assets: ['app.js', 'vendor.js', 'app.css'] }],
    },
    moduleGraph: {
      modules: [
        { id: 1, kind: 0, chunks: ['main', 'vendor'] },
        { id: 2, kind: 1, chunks: ['main', 'vendor'], modules: [3, 5] },
        { id: 3, kind: 0, chunks: [] },
        { id: 4, kind: 0, chunks: ['lazy'] },
        { id: 5, kind: 0, chunks: [] },
        { id: 6, kind: 0, chunks: [], path: '/src/styles.css' },
      ],
      dependencies: [{ kind: 1 }, { kind: 1 }, { kind: 2 }, { kind: 3 }, { kind: 0 }],
    },
    summary: { costs: [{ name: 'beforeCompile->afterCompile', costs: 12.6 }] },
    loader: [
      {
        loaders: [
          { startAt: 100.25, endAt: 110.75 },
          { startAt: 105.25, endAt: 110.75 },
        ],
      },
    ],
    errors: [
      { code: 'OVERLAY', level: 'warn', category: 'compile' },
      { code: 'E1001', level: 'warn', category: 'bundle' },
      { code: 'OVERLAY', level: 'error', category: 'bundle' },
    ],
  };
}

describe('reportBundleMetrics', () => {
  it('collects metrics from relocated, sharded report sections', async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'build-stats-'));
    t.after(() => rm(directory, { recursive: true, force: true }));

    const profileDirectory = join(directory, '.rsdoctor');
    await writeReport(profileDirectory, rsdoctorReport());

    assert.deepEqual(await readRsdoctorMetrics(profileDirectory), rsdoctorMetrics);
  });

  it('keeps independent metrics when report sections or shards are missing', async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'build-stats-'));
    t.after(() => rm(directory, { recursive: true, force: true }));

    const partialFieldProfile = join(directory, 'partial-field');
    const partialShardProfile = join(directory, 'partial-shard');
    const moduleOnlyProfile = join(directory, 'module-only');
    const report = rsdoctorReport();
    await writeReport(partialFieldProfile, {
      chunkGraph: { chunks: [], assets: [], entrypoints: [] },
      summary: report.summary,
    });
    await writeReport(partialShardProfile, report);
    await rm(join(partialShardProfile, 'moduleGraph', '1'));
    await writeReport(moduleOnlyProfile, { moduleGraph: report.moduleGraph });

    assert.deepEqual(await readRsdoctorMetrics(join(directory, 'missing')), {});
    assert.deepEqual(await readRsdoctorMetrics(partialFieldProfile), {
      initialChunks: 0,
      asyncChunks: 0,
      largestAsyncJsBytes: 0,
      compileMs: 13,
    });

    const partialMetrics = await readRsdoctorMetrics(partialShardProfile);
    assert.equal(partialMetrics['entrypoints.app.js.bytes'], 130);
    assert.equal(partialMetrics.compileMs, 13);
    assert.equal(partialMetrics.loaderInvocations, 2);
    assert.equal(partialMetrics.compilerWarnings, 1);
    assert.equal(partialMetrics.initialModules, undefined);
    assert.equal(partialMetrics['dependencies.staticImports'], undefined);
    assert.deepEqual(await readRsdoctorMetrics(moduleOnlyProfile), {
      'dependencies.staticImports': 2,
      'dependencies.dynamicImports': 1,
      'dependencies.requireCalls': 1,
      'dependencies.amdRequires': 0,
      'dependencies.unknown': 1,
    });
  });

  it('rejects corrupt present shards instead of silently omitting metrics', async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'build-stats-'));
    t.after(() => rm(directory, { recursive: true, force: true }));

    const profileDirectory = join(directory, 'relocated');
    await writeReport(profileDirectory, rsdoctorReport());
    assert.equal((await readRsdoctorMetrics(profileDirectory)).initialModules, 4);

    await writeFile(
      join(profileDirectory, 'moduleGraph', basename('/producer-machine/rsdoctor-report/moduleGraph/0')),
      'invalid'
    );
    await assert.rejects(readRsdoctorMetrics(profileDirectory));
  });

  it('sums de-duplicated default assets and preserves shared assets when the Rspack manifest is absent', async (t) => {
    const buildDirectory = await createBuildFixture(t);

    assert.deepEqual(await readBundleSizes(buildDirectory), {
      'default.entrypoints.app.js': 21,
      'default.entrypoints.app.css': 5,
      'default.entrypoints.admin.js': 18,
      'default.entrypoints.admin.css': 14,
    });
  });

  it('adds de-duplicated Rspack assets while resolving them from the build directory root', async (t) => {
    const buildDirectory = await createBuildFixture(t, { includeRspack: true });

    assert.deepEqual(await readBundleSizes(buildDirectory), {
      'default.entrypoints.app.js': 21,
      'default.entrypoints.app.css': 5,
      'default.entrypoints.admin.js': 18,
      'default.entrypoints.admin.css': 14,
      'rspack.entrypoints.app.js': 42,
      'rspack.entrypoints.app.css': 12,
      'rspack.entrypoints.admin.js': 44,
      'rspack.entrypoints.admin.css': 28,
    });
  });

  it('rejects malformed Rspack manifests and referenced Rspack assets that are missing', async (t) => {
    const buildDirectory = await createBuildFixture(t, { includeRspack: true });
    const manifestPath = join(buildDirectory, 'rspack', 'assets-manifest.json');

    await writeFile(manifestPath, '{not JSON', 'utf8');
    await assert.rejects(readBundleSizes(buildDirectory));

    await writeFile(manifestPath, '{}', 'utf8');
    await assert.rejects(readBundleSizes(buildDirectory));

    await writeRspackFixture(buildDirectory);
    await rm(join(buildDirectory, 'rspack', 'app.js'));
    await assert.rejects(readBundleSizes(buildDirectory));
  });

  it('reports Rspack size metrics without a profile and reports profile metrics independently', async (t) => {
    const buildDirectory = await createBuildFixture(t, { includeRspack: true });
    await writeReport(join(buildDirectory, '.rsdoctor'), rsdoctorReport());

    let result = spawnSync(process.execPath, [cliPath, buildDirectory], {
      cwd: buildDirectory,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, bundleSizeOutput + rspackBundleSizeOutput);
    assert.equal(result.stderr, '');

    await writeReport(join(buildDirectory, 'rspack', '.rsdoctor'), rsdoctorReport());

    result = spawnSync(process.execPath, [cliPath, buildDirectory], {
      cwd: buildDirectory,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    assert.equal(
      result.stdout.slice(0, bundleSizeOutput.length + rspackBundleSizeOutput.length),
      bundleSizeOutput + rspackBundleSizeOutput
    );
    assert.deepEqual(
      result.stdout
        .slice(bundleSizeOutput.length + rspackBundleSizeOutput.length)
        .trim()
        .split('\n')
        .sort(),
      Object.entries(rsdoctorMetrics)
        .map(([name, value]) => `build.rspack.${name} ${value}`)
        .sort()
    );
    assert.equal(result.stderr, '');
  });

  it('emits legacy size rows with a positional build directory despite corrupt Rspack manifests and profiles', async (t) => {
    const buildDirectory = await createBuildFixture(t, { includeRspack: true });
    const profileDirectory = join(buildDirectory, 'rspack', '.rsdoctor');
    await mkdir(profileDirectory, { recursive: true });
    await Promise.all([
      writeFile(join(buildDirectory, 'rspack', 'assets-manifest.json'), '{not JSON', 'utf8'),
      writeFile(join(profileDirectory, 'manifest.json'), '{not JSON', 'utf8'),
    ]);

    const result = spawnSync(process.execPath, [cliPath, '--sizes-only', buildDirectory], {
      cwd: buildDirectory,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0);
    assert.equal(result.stdout, legacySizeOutput);
    assert.equal(result.stderr, '');
  });
});
