import execa = require('execa');
import { promises as fs } from 'fs';
// @ts-ignore
import * as path from 'path';
import chalk from 'chalk';
import { useSpinner } from '../utils/useSpinner';
import { Task, TaskRunner } from './task';
import globby from 'globby';

let distDir: string, cwd: string;

export const clean = useSpinner('Cleaning', () => execa('npm', ['run', 'clean']));

const compile = useSpinner('Compiling sources', () => execa('tsc', ['-p', './tsconfig.build.json']));

const rollup = useSpinner('Bundling', () => execa('npm', ['run', 'bundle']));

interface SavePackageOptions {
  path: string;
  pkg: {};
}

export const savePackage = useSpinner<SavePackageOptions>(
  'Updating package.json',
  ({ path, pkg }: SavePackageOptions) => fs.writeFile(path, JSON.stringify(pkg, null, 2))
);

const preparePackage = async (pkg: any) => {
  pkg.main = 'index.js';
  pkg.types = 'index.d.ts';

  const version: string = pkg.version;
  const name: string = pkg.name;
  const deps: any = pkg.dependencies;

  // Below we are adding cross-dependencies to Grafana's packages
  // with the version being published
  if (name.endsWith('/ui')) {
    deps['@grafana/data'] = version;
  } else if (name.endsWith('/runtime')) {
    deps['@grafana/data'] = version;
    deps['@grafana/ui'] = version;
  } else if (name.endsWith('/toolkit')) {
    deps['@grafana/data'] = version;
    deps['@grafana/ui'] = version;
  }

  await savePackage({
    path: `${cwd}/dist/package.json`,
    pkg,
  });
};

const moveFiles = () => {
  const files = ['README.md', 'CHANGELOG.md', 'index.js'];

  return useSpinner(`Moving ${files.join(', ')} files`, () => {
    const promises = files.map(file => fs.copyFile(`${cwd}/${file}`, `${distDir}/${file}`));
    return Promise.all(promises);
  })();
};

const moveStaticFiles = async (pkg: any) => {
  if (pkg.name.endsWith('/ui')) {
    return useSpinner('Moving static files', async () => {
      const staticFiles = await globby('src/**/*.{png,svg,gif,jpg}');
      const promises = staticFiles.map(file => fs.copyFile(file, file.replace(/^src/, 'compiled')));
      await Promise.all(promises);
    })();
  }
};

interface PackageBuildOptions {
  scope: string;
}

const buildTaskRunner: TaskRunner<PackageBuildOptions> = async ({ scope }) => {
  if (!scope) {
    throw new Error('Provide packages with -s, --scope <packages>');
  }

  const scopes = scope.split(',').map(s => {
    return async () => {
      cwd = path.resolve(__dirname, `../../../../grafana-${s}`);
      // Lerna executes this in package's dir context, but for testing purposes I want to be able to run from root:
      // grafana-toolkit package:build --scope=<package>
      process.chdir(cwd);
      distDir = `${cwd}/dist`;
      const pkg = require(`${cwd}/package.json`);
      console.log(chalk.yellow(`Building ${pkg.name} (package.json version: ${pkg.version})`));

      await clean();
      await compile();
      await moveStaticFiles(pkg);
      await rollup();
      await preparePackage(pkg);
      await moveFiles();
    };
  });

  await Promise.all(scopes.map(s => s()));
};

export const buildPackageTask = new Task<PackageBuildOptions>('Package build', buildTaskRunner);
