import execa = require('execa');
import * as fs from 'fs';
import chalk from 'chalk';
import { useSpinner } from '../utils/useSpinner';
import { Task, TaskRunner } from './task';

const path = require('path');

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

const copyFiles = () => {
  const files = [
    'README.md',
    'CHANGELOG.md',
    'bin/grafana-toolkit.dist.js',
    'src/config/prettier.plugin.config.json',
    'src/config/prettier.plugin.rc.js',
    'src/config/tsconfig.plugin.json',
    'src/config/tsconfig.plugin.local.json',
    'src/config/eslint.plugin.json',
    'src/config/styles.mock.js',
    'src/config/jest.plugin.config.local.js',
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

const copySassFiles = () => {
  const files = ['_variables.generated.scss', '_variables.dark.generated.scss', '_variables.light.generated.scss'];
  // @ts-ignore
  return useSpinner<void>(`Copy scss files ${files.join(', ')} files`, async () => {
    const sassDir = path.resolve(cwd, '../../public/sass/');
    const promises = files.map(file => {
      return new Promise((resolve, reject) => {
        const name = file.replace('.generated', '');
        fs.copyFile(`${sassDir}/${file}`, `${distDir}/sass/${name}`, err => {
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

interface ToolkitBuildOptions {}

const toolkitBuildTaskRunner: TaskRunner<ToolkitBuildOptions> = async () => {
  cwd = path.resolve(__dirname, '../../../');
  distDir = `${cwd}/dist`;
  const pkg = require(`${cwd}/package.json`);
  console.log(chalk.yellow(`Building ${pkg.name} (package.json version: ${pkg.version})`));

  await clean();
  await compile();
  await preparePackage(pkg);
  fs.mkdirSync('./dist/bin');
  fs.mkdirSync('./dist/sass');
  await copyFiles();
  await copySassFiles();
};

export const toolkitBuildTask = new Task<ToolkitBuildOptions>('@grafana/toolkit build', toolkitBuildTaskRunner);
