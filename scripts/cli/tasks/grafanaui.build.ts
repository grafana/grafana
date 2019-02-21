import execa from 'execa';
import fs from 'fs';
import { Task } from '..';
import { changeCwdToGrafanaUi, restoreCwd } from '../utils/cwd';
import chalk from 'chalk';
import { startSpinner } from '../utils/startSpinner';

let distDir, cwd;

const clean = async () => {
  const spinner = startSpinner('Cleaning');
  try {
    await execa('npm', ['run', 'clean']);
    spinner.succeed();
  } catch (e) {
    spinner.fail();
    throw e;
  }
};

const compile = async () => {
  const spinner = startSpinner('Compiling sources');
  try {
    await execa('tsc', ['-p', './tsconfig.build.json']);
    spinner.succeed();
  } catch (e) {
    console.log(e);
    spinner.fail();
  }
};

const rollup = async () => {
  const spinner = startSpinner('Bundling');

  try {
    await execa('npm', ['run', 'build']);
    spinner.succeed();
  } catch (e) {
    spinner.fail();
  }
};

export const savePackage = async (path, pkg) => {
  const spinner = startSpinner('Updating package.json');

  return new Promise((resolve, reject) => {
    fs.writeFile(path, JSON.stringify(pkg, null, 2), err => {
      if (err) {
        spinner.fail();
        console.error(err);
        reject(err);
        return;
      }
      spinner.succeed();
      resolve();
    });
  });
};

const preparePackage = async pkg => {
  pkg.main = 'index.js';
  pkg.types = 'index.d.ts';
  await savePackage(`${cwd}/dist/package.json`, pkg);
};

const moveFiles = async () => {
  const files = ['README.md', 'CHANGELOG.md', 'index.js'];
  const spinner = startSpinner(`Moving ${files.join(', ')} files`);

  const promises = files.map(file => {
    return fs.copyFile(`${cwd}/${file}`, `${distDir}/${file}`, err => {
      if (err) {
        console.error(err);
        return;
      }
    });
  });

  try {
    await Promise.all(promises);
    spinner.succeed();
  } catch (e) {
    spinner.fail();
  }
};

const buildTask: Task<void> = async () => {
  cwd = changeCwdToGrafanaUi();
  distDir = `${cwd}/dist`;
  const pkg = require(`${cwd}/package.json`);

  console.log(chalk.yellow(`Building ${pkg.name} @ ${pkg.version}`));

  await clean();
  await compile();
  await rollup();
  await preparePackage(pkg);
  await moveFiles();

  restoreCwd();
};

export default buildTask;
