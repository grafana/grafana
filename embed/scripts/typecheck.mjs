// Gates on type errors in embed/src only.
//
// tsc follows the app import graph, so a whole-program check here also reports
// errors from packages/* and public/app/* whose own settings differ from this
// config (jest globals, newer Intl lib). Those files are already covered by the
// repo root `yarn typecheck`, so re-reporting them here would only add noise.
import { spawnSync } from 'node:child_process';

const tsc = spawnSync('../node_modules/.bin/tsc', ['--noEmit', '--pretty', 'false'], {
  cwd: import.meta.dirname + '/..',
  encoding: 'utf8',
});

const own = (tsc.stdout ?? '').split('\n').filter((line) => /^src\/.*error TS/.test(line));

if (own.length > 0) {
  console.error(own.join('\n'));
  console.error(`\n${own.length} type error(s) in embed/src`);
  process.exit(1);
}
console.log('embed/src: no type errors');
