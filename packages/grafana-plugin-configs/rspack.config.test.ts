import { type Configuration } from '@rspack/core';
import fs from 'node:fs';
import path from 'node:path';
import ReplaceInFileWebpackPlugin from 'replace-in-file-webpack-plugin';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { compile, readAssets } from '../../scripts/rspack/plugins/testUtils.ts';

import config, { type Env } from './rspack.config.ts';

const FIXTURE_DIR = path.join(import.meta.dirname, '__fixtures__', 'test-plugin');
const ROOT_LICENSE = path.resolve(import.meta.dirname, '../../LICENSE');
const OUTPUT_PATH = '/dist';
const BANNER = '/* [create-plugin] version: 5.22.0 */';

async function createConfig(env: Env): Promise<Configuration> {
  const pluginConfig = await config(env, FIXTURE_DIR);

  return {
    ...pluginConfig,
    // The config derives `context` and `output.path` from process.cwd() because
    // each plugin runs its own build from its own directory. Point them at the
    // fixture instead of the repo root, and drop `clean` so the compilation
    // never touches the real output directory.
    context: FIXTURE_DIR,
    output: { ...pluginConfig.output, path: OUTPUT_PATH, clean: false },
    // ReplaceInFileWebpackPlugin rewrites the emitted files on the real
    // filesystem, which an in-memory output filesystem never produces.
    plugins: pluginConfig.plugins?.filter((plugin) => !(plugin instanceof ReplaceInFileWebpackPlugin)),
  };
}

describe('plugin rspack config', () => {
  // The config sets no `target`, so rspack resolves one from .browserslistrc.
  // Vitest sets NODE_ENV=test and .browserslistrc has no [test] section, which
  // resolves to an empty browser list and fails the compilation.
  beforeAll(() => {
    vi.stubEnv('BROWSERSLIST_ENV', 'production');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('emits the repo-root LICENSE byte-for-byte for plugins without their own', async () => {
    const { outputFs } = await compile(await createConfig({ production: true }));
    const assets = readAssets(outputFs, OUTPUT_PATH);

    expect(assets['LICENSE']).toBe(fs.readFileSync(ROOT_LICENSE, 'utf-8'));
  });

  it('keeps the create-plugin banner after minification', async () => {
    const { outputFs } = await compile(await createConfig({ production: true }));
    const assets = readAssets(outputFs, OUTPUT_PATH);

    expect(assets['module.js']).toContain(BANNER);
    // Proves minification actually ran, so the banner survived it rather than
    // the minimizer having been skipped.
    expect(assets['module.js']).not.toContain('fixture-source-comment');
  });

  it('extracts third-party license notices into a sidecar instead of dropping them', async () => {
    const { outputFs } = await compile(await createConfig({ production: true }));
    const assets = readAssets(outputFs, OUTPUT_PATH);

    expect(assets['module.js.LICENSE.txt']).toContain('fixture-license-notice');
    expect(assets['module.js']).not.toContain('fixture-license-notice');
  });

  it('resolves the define.amd branch of bundled UMD deps at build time', async () => {
    const { outputFs } = await compile(await createConfig({ production: true }));
    const assets = readAssets(outputFs, OUTPUT_PATH);

    // Without `amd`, the check is left in the bundle and evaluated at load
    // time — where the global `define` SystemJS installs makes it truthy, so
    // the dep registers with SystemJS, exports nothing, and the plugin throws.
    expect(assets['module.js']).not.toContain('define.amd');
    expect(assets['module.js']).toContain('umd-dep-payload');
  });

  it('drops console.log and console.info but keeps warn and error', async () => {
    const { outputFs } = await compile(await createConfig({ production: true }));
    const assets = readAssets(outputFs, OUTPUT_PATH);

    expect(assets['module.js']).not.toContain('pure_funcs must drop this');
    expect(assets['module.js']).toContain('pure_funcs must keep this');
  });
});
