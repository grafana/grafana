import chalk from 'chalk';
import execa = require('execa');
import { promises as fs } from 'fs';
import globby from 'globby';
import { cloneDeep } from 'lodash';
import * as path from 'path';

import { useSpinner } from '../utils/useSpinner';

import { Task, TaskRunner } from './task';

const clean = (cwd: string) => useSpinner('Cleaning', () => execa('npm', ['run', 'clean'], { cwd }));

const compile = (cwd: string) =>
  useSpinner('Compiling sources', () => execa('tsc', ['-p', './tsconfig.build.json'], { cwd }));

const bundle = (cwd: string) => useSpinner('Bundling', () => execa('npm', ['run', 'bundle'], { cwd }));

const preparePackage = async (packageDist: string, pkg: any) => {
  pkg = cloneDeep(pkg); // avoid mutations

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

  await useSpinner('Updating package.json', () =>
    fs.writeFile(`${packageDist}/package.json`, JSON.stringify(pkg, null, 2))
  );
};

const moveFiles = (fromPath: string, toPath: string) => {
  const files = ['README.md', 'CHANGELOG.md', 'index.js'];

  return useSpinner(`Moving ${files.join(', ')} files`, () => {
    const promises = files.map((file) => fs.copyFile(`${fromPath}/${file}`, `${toPath}/${file}`));
    return Promise.all(promises);
  });
};

const moveStaticFiles = async (packageRoot: string, pkg: any) => {
  if (pkg.name.endsWith('/ui')) {
    return useSpinner('Moving static files', async () => {
      const staticFiles = await globby(`${packageRoot}/src/**/*.{png,svg,gif,jpg}`);
      const pathSearch = new RegExp(`^${packageRoot}/src`);
      const pathReplace = `${packageRoot}/compiled`;
      const promises = staticFiles.map((file) => fs.copyFile(file, file.replace(pathSearch, pathReplace)));
      await Promise.all(promises);
    });
  }
};

interface PackageBuildOptions {
  scope: string;
}

const buildTaskRunner: TaskRunner<PackageBuildOptions> = async ({ scope }) => {
  if (!scope) {
    throw new Error('Provide packages with -s, --scope <packages>');
  }

  const scopes = scope.split(',').map(async (s) => {
    const packageRoot = path.resolve(__dirname, `../../../../grafana-${s}`);
    const packageDist = `${packageRoot}/dist`;
    const pkg = require(`${packageRoot}/package.json`);
    console.log(chalk.yellow(`Building ${pkg.name} (package.json version: ${pkg.version})`));
    await clean(packageRoot);
    await compile(packageRoot);
    await moveStaticFiles(packageRoot, pkg);
    await bundle(packageRoot);
    await preparePackage(packageDist, pkg);
    await moveFiles(packageRoot, packageDist);
  });

  await Promise.all(scopes);
};

export const buildPackageTask = new Task<PackageBuildOptions>('Package build', buildTaskRunner);
