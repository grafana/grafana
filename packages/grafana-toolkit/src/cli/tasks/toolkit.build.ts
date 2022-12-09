import chalk from 'chalk';
import execa = require('execa');
import * as fs from 'fs';

import { useSpinner } from '../utils/useSpinner';

import { Task, TaskRunner } from './task';

const path = require('path');

let distDir: string, cwd: string;

const clean = () => useSpinner('Cleaning', () => execa('npm', ['run', 'clean']));

const compile = () =>
  useSpinner('Compiling sources', async () => {
    try {
      await execa('tsc', ['-p', './tsconfig.json']);
    } catch (e) {
      console.log(e);
      throw e;
    }
  });

const copyFiles = () => {
  const files = [
    'src/config/prettier.plugin.config.json',
    'src/config/prettier.plugin.rc.js',
    'src/config/tsconfig.plugin.json',
    'src/config/tsconfig.plugin.local.json',
    'src/config/eslint.plugin.js',
    'src/config/styles.mock.js',
    'src/config/jest.babel.config.js',
    'src/config/jest.plugin.config.local.js',
    'src/config/matchMedia.js',
    'src/config/react-inlinesvg.tsx',
  ];

  return useSpinner(`Moving ${files.join(', ')} files`, async () => {
    const promises = files.map((file) => {
      return new Promise<void>((resolve, reject) => {
        const basedir = path.dirname(`${distDir}/${file}`);
        if (!fs.existsSync(basedir)) {
          fs.mkdirSync(basedir, { recursive: true });
        }
        fs.copyFile(`${cwd}/${file}`, `${distDir}/${file}`, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });

    await Promise.all(promises);
  });
};

const copySassFiles = () => {
  const files = ['_variables.generated.scss', '_variables.dark.generated.scss', '_variables.light.generated.scss'];
  const exportDir = `${cwd}/sass`;
  return useSpinner(`Copy scss files ${files.join(', ')} files`, async () => {
    const sassDir = path.resolve(cwd, '../../public/sass/');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir);
    }
    const promises = files.map((file) => {
      return new Promise<void>((resolve, reject) => {
        const name = file.replace('.generated', '');
        fs.copyFile(`${sassDir}/${file}`, `${exportDir}/${name}`, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });

    await Promise.all(promises);
  });
};

interface ToolkitBuildOptions {}

const toolkitBuildTaskRunner: TaskRunner<ToolkitBuildOptions> = async () => {
  cwd = path.resolve(__dirname, '../../../');
  distDir = `${cwd}/dist`;
  const pkg = require(`${cwd}/package.json`);
  console.log(chalk.yellow(`Building ${pkg.name} (package.json version: ${pkg.version})`));

  await clean();
  await compile();
  await copyFiles();
  await copySassFiles();
};

export const toolkitBuildTask = new Task<ToolkitBuildOptions>('@grafana/toolkit build', toolkitBuildTaskRunner);
