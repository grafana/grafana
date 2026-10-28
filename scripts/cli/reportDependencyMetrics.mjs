import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function countYarnPackages(recursive) {
  const output = execFileSync(
    'yarn',
    ['info', '**', '--all', ...(recursive ? ['--recursive'] : []), '--name-only', '--json'],
    {
      encoding: 'utf8',
    }
  );
  let count = 0;
  for (const line of output.trim().split('\n')) {
    if (!/@(workspace|link):/.test(JSON.parse(line))) {
      count++;
    }
  }
  return count;
}

// Counts unique resolved packages. Tree nodes of workspace projects are walked but not counted.
const countPnpmPackages = (depth) => {
  const projects = JSON.parse(
    execFileSync('pnpm', ['list', '--recursive', '--depth', depth, '--lockfile-only', '--json'], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    })
  );

  const ids = new Set();
  const collect = (dependencies) => {
    for (const [name, dependency] of Object.entries(dependencies ?? {})) {
      if (!dependency.version.startsWith('link:')) {
        // `from` is the real package name, which differs from the key for aliased dependencies.
        ids.add(`${dependency.from ?? name}@${dependency.version}`);
      }
      collect(dependency.dependencies);
    }
  };

  for (const project of projects) {
    for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      collect(project[group]);
    }
  }

  return ids.size;
};

const packageManager = JSON.parse(readFileSync('package.json', 'utf8')).packageManager.split('@')[0];

if (packageManager === 'yarn') {
  console.log(`${countYarnPackages(false)} ${countYarnPackages(true)}`);
} else if (packageManager === 'pnpm') {
  console.log(`${countPnpmPackages(0)} ${countPnpmPackages('Infinity')}`);
} else {
  throw new Error(`Unsupported package manager: ${packageManager}`);
}
