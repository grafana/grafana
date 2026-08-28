// Two workspace invariants that pnpm has no built-in equivalent of, so they are
// checked here rather than by `yarn constraints`:
//   1. Every workspace that declares `packageManager` must match the root,
//      otherwise corepack resolves a different pnpm per directory and builds fail.
//   2. Public packages must not pin production dependencies, or consumers end up
//      with duplicate copies they cannot dedupe.
import { getPackagesSync } from '@manypkg/get-packages';
import fs from 'node:fs';
import path from 'node:path';
import semver from 'semver';

// Monorepo packages are released in lockstep, and @grafana/react-data-grid is a
// fork on beta releases, so a caret range would drift onto an unreleased version.
const PERMITTED_PINNED_PRODUCTION_DEPENDENCIES = new Set([
  '@grafana/api-clients',
  '@grafana/i18n',
  '@grafana/schema',
  '@grafana/data',
  '@grafana/ui',
  '@grafana/runtime',
  '@grafana/e2e-selectors',
  '@grafana/react-data-grid',
]);

const { rootPackage, packages } = getPackagesSync(process.cwd());
const expected = rootPackage.packageJson.packageManager;
const fix = process.argv.includes('--fix');

if (!expected) {
  console.error('ERROR! The root package.json has no "packageManager" field.');
  process.exit(1);
}

/** @type {Array<{ dir: string, edit: (contents: string) => string, message: string }>} */
const problems = [];

for (const pkg of packages) {
  if (pkg.packageJson.packageManager && pkg.packageJson.packageManager !== expected) {
    problems.push({
      dir: pkg.dir,
      message: `expected packageManager "${expected}", found "${pkg.packageJson.packageManager}"`,
      edit: (contents) =>
        contents.replace(/"packageManager":\s*"[^"]*"/, `"packageManager": ${JSON.stringify(expected)}`),
    });
  }

  if (pkg.packageJson.publishConfig?.access !== 'public') {
    continue;
  }

  for (const [name, range] of Object.entries(pkg.packageJson.dependencies ?? {})) {
    if (PERMITTED_PINNED_PRODUCTION_DEPENDENCIES.has(name)) {
      continue;
    }

    // A range yarn's constraint would have widened: anything that coerces to a
    // single version (a bare pin) rather than an existing range.
    const coerced = semver.coerce(range, { includePrerelease: true });
    if (!coerced || range === `^${coerced.version}`) {
      continue;
    }
    if (!semver.valid(range)) {
      continue;
    }

    problems.push({
      dir: pkg.dir,
      message: `pinned production dependency ${name}@${range} is not allowed in public packages; use a ^ range or add an exception to scripts/check-package-manager.mjs`,
      edit: (contents) =>
        contents.replace(
          new RegExp(`("${name.replace(/[/@]/g, '\\$&')}":\\s*")${range.replace(/[.+]/g, '\\$&')}(")`),
          `$1^${coerced.version}$2`
        ),
    });
  }
}

if (problems.length === 0) {
  process.exit(0);
}

for (const problem of problems) {
  const relative = path.relative(rootPackage.dir, problem.dir) || '.';
  if (!fix) {
    console.error(`${relative}: ${problem.message}`);
    continue;
  }
  const manifest = path.join(problem.dir, 'package.json');
  fs.writeFileSync(manifest, problem.edit(fs.readFileSync(manifest, 'utf8')));
  console.log(`${relative}: fixed — ${problem.message}`);
}

process.exit(fix ? 0 : 1);
