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

async function writeReport(profileDirectory, { chunkGraph, moduleGraph }) {
  const data = {};

  for (const [field, graph] of Object.entries({ chunkGraph, moduleGraph })) {
    if (graph === undefined) {
      continue;
    }

    const encoded = deflateSync(JSON.stringify(graph)).toString('base64');
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

async function createBuildFixture(t) {
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

  return directory;
}

function initialChunkModules() {
  return {
    chunkGraph: {
      chunks: [
        { id: 'main', initial: true, modules: [1, 2, 5, 6] },
        { id: 'vendor', initial: true, modules: [1, 2] },
        { id: 'lazy', initial: false, modules: [4] },
      ],
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
    },
  };
}

describe('reportBundleMetrics', () => {
  it('counts unique normal modules reachable from initial chunks', async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'build-stats-'));
    t.after(() => rm(directory, { recursive: true, force: true }));

    const profileDirectory = join(directory, '.rsdoctor');
    await writeReport(profileDirectory, initialChunkModules());

    assert.deepEqual(await readRsdoctorMetrics(profileDirectory), { initialModules: 4 });
  });

  it('returns unavailable for missing or partial reports and zero for a valid empty initial set', async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'build-stats-'));
    t.after(() => rm(directory, { recursive: true, force: true }));

    const partialFieldProfile = join(directory, 'partial-field');
    const partialShardProfile = join(directory, 'partial-shard');
    const emptyProfile = join(directory, 'empty');
    await writeReport(partialFieldProfile, { chunkGraph: { chunks: [] } });
    await writeReport(partialShardProfile, initialChunkModules());
    await rm(join(partialShardProfile, 'moduleGraph', '1'));
    await writeReport(emptyProfile, {
      chunkGraph: { chunks: [{ id: 'lazy', initial: false, modules: [1] }] },
      moduleGraph: { modules: [{ id: 1, kind: 0, chunks: ['lazy'] }] },
    });

    assert.deepEqual(await readRsdoctorMetrics(join(directory, 'missing')), {});
    assert.deepEqual(await readRsdoctorMetrics(partialFieldProfile), {});
    assert.deepEqual(await readRsdoctorMetrics(partialShardProfile), {});
    assert.deepEqual(await readRsdoctorMetrics(emptyProfile), { initialModules: 0 });
  });

  it('reads relocated shards and rejects malformed present graph data', async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'build-stats-'));
    t.after(() => rm(directory, { recursive: true, force: true }));

    const profileDirectory = join(directory, 'relocated');
    await writeReport(profileDirectory, {
      chunkGraph: { chunks: [{ id: 'main', initial: true, modules: [1] }] },
      moduleGraph: { modules: [{ id: 1, kind: 0, chunks: [] }] },
    });

    assert.deepEqual(await readRsdoctorMetrics(profileDirectory), { initialModules: 1 });

    await writeFile(
      join(profileDirectory, 'moduleGraph', basename('/producer-machine/rsdoctor-report/moduleGraph/0')),
      'invalid'
    );
    await assert.rejects(readRsdoctorMetrics(profileDirectory));
  });

  it('sums de-duplicated assets and preserves shared assets in every entrypoint group', async (t) => {
    const buildDirectory = await createBuildFixture(t);

    assert.deepEqual(await readBundleSizes(buildDirectory), {
      'default.entrypoints.app.js': 21,
      'default.entrypoints.app.css': 5,
      'default.entrypoints.admin.js': 18,
      'default.entrypoints.admin.css': 14,
    });
  });

  it('reports size metrics without Rspack and adds only the Rspack module metric when present', async (t) => {
    const buildDirectory = await createBuildFixture(t);
    await writeReport(join(buildDirectory, '.rsdoctor'), initialChunkModules());

    let result = spawnSync(process.execPath, [cliPath, buildDirectory], {
      cwd: buildDirectory,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, bundleSizeOutput);
    assert.equal(result.stderr, '');

    await writeReport(join(buildDirectory, 'rspack', '.rsdoctor'), {
      chunkGraph: { chunks: [{ id: 'main', initial: true, modules: [1] }] },
      moduleGraph: { modules: [{ id: 1, kind: 0, chunks: [] }] },
    });

    result = spawnSync(process.execPath, [cliPath, buildDirectory], {
      cwd: buildDirectory,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, bundleSizeOutput + 'build.rspack.initialModules 1\n');
    assert.equal(result.stderr, '');
  });

  it('emits legacy size rows with a positional build directory despite corrupt Rspack artifacts', async (t) => {
    const buildDirectory = await createBuildFixture(t);
    const profileDirectory = join(buildDirectory, 'rspack', '.rsdoctor');
    await mkdir(profileDirectory, { recursive: true });
    await writeFile(join(profileDirectory, 'manifest.json'), '{not JSON', 'utf8');

    const result = spawnSync(process.execPath, [cliPath, '--sizes-only', buildDirectory], {
      cwd: buildDirectory,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0);
    assert.equal(result.stdout, legacySizeOutput);
    assert.equal(result.stderr, '');
  });
});
