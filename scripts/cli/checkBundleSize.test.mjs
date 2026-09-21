import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { compareBundleSizes, formatBundleSizeReport, parseBundleSizes } from './checkBundleSize.mjs';

describe('checkBundleSize', () => {
  it('marks only asset groups that exceed the increase limit', () => {
    const base = parseBundleSizes('default.entrypoints.app.js 100000\ndefault.entrypoints.dark.css 20000\n');
    const current = parseBundleSizes(
      'default.entrypoints.app.js 151201\ndefault.entrypoints.dark.css 71200\ndefault.entrypoints.new.js 60000\n'
    );

    assert.deepEqual(compareBundleSizes(base, current, 51200), [
      {
        name: 'default.entrypoints.app.js',
        baseSize: 100000,
        currentSize: 151201,
        change: 51201,
        tooLarge: true,
      },
      {
        name: 'default.entrypoints.dark.css',
        baseSize: 20000,
        currentSize: 71200,
        change: 51200,
        tooLarge: false,
      },
      {
        name: 'default.entrypoints.new.js',
        baseSize: 0,
        currentSize: 60000,
        change: 60000,
        tooLarge: true,
      },
    ]);
  });

  it('formats a job summary with signed changes and results', () => {
    const report = formatBundleSizeReport(
      [
        {
          name: 'default.entrypoints.app.js',
          baseSize: 102400,
          currentSize: 153600,
          change: 51200,
          tooLarge: false,
        },
        {
          name: 'default.entrypoints.dark.css',
          baseSize: 20480,
          currentSize: 10240,
          change: -10240,
          tooLarge: false,
        },
      ],
      51200
    );

    assert.equal(
      report,
      `## Bundle size impact

The maximum allowed increase for any entrypoint asset group is 50.0 KiB.

| Asset group | Base | PR | Change | Result |
| --- | ---: | ---: | ---: | --- |
| \`default.entrypoints.app.js\` | 100.0 KiB | 150.0 KiB | +50.0 KiB | OK |
| \`default.entrypoints.dark.css\` | 20.0 KiB | 10.0 KiB | -10.0 KiB | OK |
`
    );
  });

  it('exits unsuccessfully when an asset group exceeds the limit', async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'bundle-size-'));
    t.after(() => rm(directory, { recursive: true, force: true }));

    const basePath = join(directory, 'base.txt');
    const currentPath = join(directory, 'current.txt');
    await Promise.all([
      writeFile(basePath, 'default.entrypoints.app.js 100000\n'),
      writeFile(currentPath, 'default.entrypoints.app.js 151201\n'),
    ]);

    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL('./checkBundleSize.mjs', import.meta.url)), basePath, currentPath, '51200'],
      { encoding: 'utf8' }
    );

    assert.equal(result.status, 1);
    assert.match(result.stdout, /\| `default\.entrypoints\.app\.js` .+ \+50\.0 KiB \| Too large \|/);
    assert.equal(result.stderr, 'Bundle size limit exceeded by: default.entrypoints.app.js\n');
  });
});
