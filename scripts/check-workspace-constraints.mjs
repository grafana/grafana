import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const rootManifest = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));

const permittedPinnedProductionDependencies = new Set([
  '@grafana/api-clients',
  '@grafana/i18n',
  '@grafana/schema',
  '@grafana/data',
  '@grafana/ui',
  '@grafana/runtime',
  '@grafana/e2e-selectors',
  '@grafana/react-data-grid',
]);

function pnpmWorkspacePatterns() {
  const path = join(rootDir, 'pnpm-workspace.yaml');
  if (!existsSync(path)) {
    return [];
  }

  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((line) => /^packages:\s*(?:#.*)?$/.test(line));
  if (start === -1) {
    throw new Error('pnpm-workspace.yaml has no packages: list');
  }

  const patterns = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }
    if (/^\S/.test(line)) {
      break;
    }
    const item = line.match(/^\s+-\s+(?:'([^']+)'|"([^"]+)"|([^#\s]+))(?:\s+#.*)?\s*$/);
    if (!item) {
      throw new Error(`Unsupported pnpm workspace package entry: ${line.trim()}`);
    }
    patterns.push(item[1] ?? item[2] ?? item[3]);
  }
  return patterns;
}

function matchingWorkspaces(pattern) {
  let directories = ['.'];
  for (const part of pattern.replace(/^\.\//, '').replace(/\/$/, '').split('/')) {
    if (part === '**') {
      const descendants = [...directories];
      for (let i = 0; i < descendants.length; i++) {
        for (const entry of readdirSync(join(rootDir, descendants[i]), { withFileTypes: true })) {
          if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
            descendants.push(join(descendants[i], entry.name));
          }
        }
      }
      directories = descendants;
      continue;
    }

    const matcher = new RegExp(
      `^${part
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replaceAll('*', '.*')
        .replaceAll('?', '.')}$`
    );
    directories = directories.flatMap((directory) =>
      readdirSync(join(rootDir, directory), { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && matcher.test(entry.name))
        .map((entry) => join(directory, entry.name))
    );
  }
  return directories.filter((directory) => existsSync(join(rootDir, directory, 'package.json')));
}

// semver.coerce(range, { includePrerelease: true }) normalizes numeric ranges to ^major.minor.patch[-prerelease].
function coerceVersion(range) {
  const match = range.match(
    /(?:^|[^\d])(\d{1,16})(?:\.(\d{1,16}))?(?:\.(\d{1,16}))?(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?/
  );
  if (!match) {
    return null;
  }
  return `${Number(match[1])}.${Number(match[2] ?? 0)}.${Number(match[3] ?? 0)}${match[4] ? `-${match[4]}` : ''}`;
}

const patterns = Array.isArray(rootManifest.workspaces) ? rootManifest.workspaces : rootManifest.workspaces?.packages;
if (!Array.isArray(patterns)) {
  throw new Error('package.json has no workspaces list');
}

const allPatterns = [...patterns, ...pnpmWorkspacePatterns()];
const directories = new Set(['.']);
for (const pattern of allPatterns.filter((pattern) => !pattern.startsWith('!'))) {
  for (const directory of matchingWorkspaces(pattern)) {
    directories.add(directory);
  }
}
for (const pattern of allPatterns.filter((pattern) => pattern.startsWith('!'))) {
  for (const directory of matchingWorkspaces(pattern.slice(1))) {
    directories.delete(directory);
  }
}

const violations = [];
for (const directory of directories) {
  const filename = join(directory, 'package.json');
  const manifest = JSON.parse(readFileSync(join(rootDir, filename), 'utf8'));
  if (manifest.packageManager && manifest.packageManager !== rootManifest.packageManager) {
    violations.push(
      `${filename}: packageManager ${manifest.packageManager} must match root ${rootManifest.packageManager}`
    );
  }
  if (manifest.publishConfig?.access !== 'public') {
    continue;
  }
  for (const [name, range] of Object.entries(manifest.dependencies ?? {})) {
    if (permittedPinnedProductionDependencies.has(name)) {
      continue;
    }
    const version = coerceVersion(range);
    if (version === null) {
      violations.push(
        `${filename}: production dependency ${name}@${range} must use a ^ range or be explicitly excepted`
      );
    } else if (range !== `^${version}`) {
      violations.push(`${filename}: production dependency ${name}@${range} must use ^${version}`);
    }
  }
}

if (violations.length) {
  for (const violation of violations) {
    console.error(violation);
  }
  process.exitCode = 1;
}
