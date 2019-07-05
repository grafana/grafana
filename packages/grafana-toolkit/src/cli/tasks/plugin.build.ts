import { Task, TaskRunner } from './task';
// @ts-ignore
import execa = require('execa');
import path = require('path');
import fs = require('fs');
import glob = require('glob');
import util = require('util');
import { Linter, Configuration, RuleFailure } from 'tslint';
import * as prettier from 'prettier';

import { useSpinner } from '../utils/useSpinner';
import { testPlugin } from './plugin/tests';
import { bundlePlugin as bundleFn, PluginBundleOptions } from './plugin/bundle';

interface PrecommitOptions {}

export const bundlePlugin = useSpinner<PluginBundleOptions>('Compiling...', async options => await bundleFn(options));

const readFileAsync = util.promisify(fs.readFile);
// @ts-ignore
export const clean = useSpinner<void>('Cleaning', async () => await execa('rimraf', [`${process.cwd()}/dist`]));

export const prepare = useSpinner<void>('Preparing', async () => {
  // Make sure a local tsconfig exists.  Otherwise this will work, but have odd behavior
  const tsConfigPath = path.resolve(process.cwd(), 'tsconfig.json');
  if (!fs.existsSync(tsConfigPath)) {
    const defaultTsConfigPath = path.resolve(__dirname, '../../config/tsconfig.plugin.local.json');
    fs.copyFile(defaultTsConfigPath, tsConfigPath, err => {
      if (err) {
        throw err;
      }
      console.log('Created tsconfig.json file');
    });
  }
  return Promise.resolve();
});

// @ts-ignore
const typecheckPlugin = useSpinner<void>('Typechecking', async () => {
  await execa('tsc', ['--noEmit']);
});

const getTypescriptSources = () => {
  const globPattern = path.resolve(process.cwd(), 'src/**/*.+(ts|tsx)');
  return glob.sync(globPattern);
};

const getStylesSources = () => {
  const globPattern = path.resolve(process.cwd(), 'src/**/*.+(scss|css)');
  return glob.sync(globPattern);
};

const prettierCheckPlugin = useSpinner<void>('Prettier check', async () => {
  const prettierConfig = require(path.resolve(__dirname, '../../config/prettier.plugin.config.json'));
  const sources = [...getStylesSources(), ...getTypescriptSources()];

  const promises = sources.map((s, i) => {
    return new Promise<{ path: string; failed: boolean }>((resolve, reject) => {
      fs.readFile(s, (err, data) => {
        let failed = false;
        if (err) {
          throw new Error(err.message);
        }

        if (
          !prettier.check(data.toString(), {
            ...prettierConfig,
            filepath: s,
          })
        ) {
          failed = true;
        }

        resolve({
          path: s,
          failed,
        });
      });
    });
  });

  const results = await Promise.all(promises);
  const failures = results.filter(r => r.failed);
  if (failures.length) {
    console.log('\nFix Prettier issues in following files:');
    failures.forEach(f => console.log(f.path));
    throw new Error('Prettier failed');
  }
});

// @ts-ignore
const lintPlugin = useSpinner<void>('Linting', async () => {
  let tsLintConfigPath = path.resolve(process.cwd(), 'tslint.json');
  if (!fs.existsSync(tsLintConfigPath)) {
    tsLintConfigPath = path.resolve(__dirname, '../../config/tslint.plugin.json');
  }
  const options = {
    fix: true, // or fail
    formatter: 'json',
  };

  const configuration = Configuration.findConfiguration(tsLintConfigPath).results;
  const sourcesToLint = getTypescriptSources();

  const lintResults = sourcesToLint
    .map(fileName => {
      const linter = new Linter(options);
      const fileContents = fs.readFileSync(fileName, 'utf8');
      linter.lint(fileName, fileContents, configuration);
      return linter.getResult();
    })
    .filter(result => {
      return result.errorCount > 0 || result.warningCount > 0;
    });

  if (lintResults.length > 0) {
    console.log('\n');
    const failures = lintResults.reduce<RuleFailure[]>((failures, result) => {
      return [...failures, ...result.failures];
    }, []);
    failures.forEach(f => {
      // tslint:disable-next-line
      console.log(
        `${f.getRuleSeverity() === 'warning' ? 'WARNING' : 'ERROR'}: ${f.getFileName().split('src')[1]}[${
          f.getStartPosition().getLineAndCharacter().line
        }:${f.getStartPosition().getLineAndCharacter().character}]: ${f.getFailure()}`
      );
    });
    console.log('\n');
    throw new Error(`${failures.length} linting errors found in ${lintResults.length} files`);
  }
});

const pluginBuildRunner: TaskRunner<PrecommitOptions> = async () => {
  await clean();
  await prepare();
  await prettierCheckPlugin();
  // @ts-ignore
  await lintPlugin();
  await testPlugin({ updateSnapshot: false, coverage: false });
  await bundlePlugin({ watch: false, production: true });
};

export const pluginBuildTask = new Task<PrecommitOptions>('Build plugin', pluginBuildRunner);
