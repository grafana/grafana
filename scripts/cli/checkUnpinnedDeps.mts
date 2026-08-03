import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as z from 'zod';

/**
 * Production dependencies that are permitted to be pinned in public packages.
 */
const permitted: {
  name: string;
  reason: string;
}[] = [
  { name: '@grafana/api-clients', reason: 'Monorepo package' },
  { name: '@grafana/i18n', reason: 'Monorepo package' },
  { name: '@grafana/schema', reason: 'Monorepo package' },
  { name: '@grafana/data', reason: 'Monorepo package' },
  { name: '@grafana/ui', reason: 'Monorepo package' },
  { name: '@grafana/runtime', reason: 'Monorepo package' },
  { name: '@grafana/e2e-selectors', reason: 'Monorepo package' },
  { name: '@grafana/react-data-grid', reason: 'Forked package with beta releases' },
];

const packageSchema = z.object({
  name: z.string(),
  dependencies: z.record(z.string(), z.string()).optional(),
  publishConfig: z.object({
    access: z.string().optional(),
  }).optional(),
});

const rootDir = new URL('../../', import.meta.url);
const packagesDir = new URL('./packages/', rootDir);

const failures: {
  packageName: string;
  packagePath: string;
  dependency: string;
  version: string;
}[] = [];

for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    continue;
  }

  const pkgPath = new URL(`./${entry.name}/package.json`, packagesDir);
  if (!fs.existsSync(pkgPath)) {
    continue;
  }

  const pkgJson = packageSchema.parse(JSON.parse(fs.readFileSync(pkgPath, 'utf-8')));
  if (pkgJson.publishConfig?.access !== 'public') {
    continue;
  }

  for (const [depName, depSpec] of Object.entries(pkgJson.dependencies ?? {})) {
    if (typeof depSpec !== 'string') {
      continue;
    }

    if (!depSpec.startsWith('^') && !permitted.some((p) => p.name === depName)) {
      failures.push({
        packageName: pkgJson.name ?? entry.name,
        packagePath: path.relative(fileURLToPath(rootDir), fileURLToPath(pkgPath)),
        dependency: depName,
        version: depSpec,
      });
    }
  }
}

if (failures.length > 0) {
  console.error('Found pinned production dependencies in public packages:');
  for (const failure of failures) {
    console.error(`- ${failure.packageName} (${failure.packagePath}): ${failure.dependency}@${failure.version}`);
  }
  process.exit(1);
}

console.log('All production dependencies of public packages are unpinned.');
