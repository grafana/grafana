// Every workspace that declares `packageManager` must match the root, otherwise
// corepack resolves a different pnpm per directory and builds fail. pnpm has no
// equivalent of `yarn constraints`, so the invariant is checked here instead.
import { getPackagesSync } from '@manypkg/get-packages';
import fs from 'node:fs';
import path from 'node:path';

const { rootPackage, packages } = getPackagesSync(process.cwd());
const expected = rootPackage.packageJson.packageManager;

if (!expected) {
  console.error('ERROR! The root package.json has no "packageManager" field.');
  process.exit(1);
}

const mismatched = packages.filter(
  (pkg) => pkg.packageJson.packageManager && pkg.packageJson.packageManager !== expected
);

if (mismatched.length === 0) {
  process.exit(0);
}

const fix = process.argv.includes('--fix');

for (const pkg of mismatched) {
  const relative = path.relative(rootPackage.dir, pkg.dir);
  if (!fix) {
    console.error(`${relative}: expected "${expected}", found "${pkg.packageJson.packageManager}"`);
    continue;
  }
  const manifest = path.join(pkg.dir, 'package.json');
  const contents = fs.readFileSync(manifest, 'utf8');
  fs.writeFileSync(
    manifest,
    contents.replace(/"packageManager":\s*"[^"]*"/, `"packageManager": ${JSON.stringify(expected)}`)
  );
  console.log(`${relative}: set "packageManager" to "${expected}"`);
}

process.exit(fix ? 0 : 1);
