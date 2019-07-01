import execa = require('execa');
import * as fs from 'fs';
import { changeCwdToGrafanaUi, restoreCwd, changeCwdToGrafanaToolkit } from '../utils/cwd';
import chalk from 'chalk';
import { useSpinner } from '../utils/useSpinner';
import { Task, TaskRunner } from './task';

let distDir: string, cwd: string;

// @ts-ignore
export const clean = useSpinner<void>('Cleaning', async () => await execa('npm', ['run', 'clean']));

// @ts-ignore
const compile = useSpinner<void>('Compiling sources', async () => {
  try {
    await execa('tsc', ['-p', './tsconfig.json']);
  } catch (e) {
    console.log(e);
    throw e;
  }
});

// @ts-ignore
export const savePackage = useSpinner<{
  path: string;
  pkg: {};
  // @ts-ignore
}>('Updating package.json', async ({ path, pkg }) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, JSON.stringify(pkg, null, 2), err => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
});

const preparePackage = async (pkg: any) => {
  pkg.bin = {
    'grafana-toolkit': './bin/grafana-toolkit.dist.js',
  };

  await savePackage({
    path: `${cwd}/dist/package.json`,
    pkg,
  });
};

const moveFiles = () => {
  const files = [
    'README.md',
    'CHANGELOG.md',
    'bin/grafana-toolkit.dist.js',
    'src/config/tsconfig.plugin.json',
    'src/config/tslint.plugin.json',
  ];
  // @ts-ignore
  return useSpinner<void>(`Moving ${files.join(', ')} files`, async () => {
    const promises = files.map(file => {
      return new Promise((resolve, reject) => {
        fs.copyFile(`${cwd}/${file}`, `${distDir}/${file}`, err => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });

    await Promise.all(promises);
  })();
};

const toolkitBuildTaskRunner: TaskRunner<void> = async () => {
  cwd = changeCwdToGrafanaToolkit();
  distDir = `${cwd}/dist`;
  const pkg = require(`${cwd}/package.json`);
  console.log(chalk.yellow(`Building ${pkg.name} (package.json version: ${pkg.version})`));

  await clean();
  await compile();
  await preparePackage(pkg);
  fs.mkdirSync('./dist/bin');
  await moveFiles();
  restoreCwd();
};

export const toolkitBuildTask = new Task<void>('@grafana/toolkit build', toolkitBuildTaskRunner);
