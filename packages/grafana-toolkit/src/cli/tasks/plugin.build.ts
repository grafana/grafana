import { Task, TaskRunner } from './task';
// @ts-ignore
import execa = require('execa');
import path = require('path');
import fs = require('fs');
import glob = require('glob');
import * as rollup from 'rollup';
import * as jestCLI from 'jest-cli';
import { jestConfig } from '../../config/jest.plugin.config';
import { inputOptions, outputOptions } from '../../config/rollup.plugin.config';

import { useSpinner } from '../utils/useSpinner';
import { Linter, Configuration, RuleFailure } from 'tslint';
interface PrecommitOptions {}

// @ts-ignore
export const clean = useSpinner<void>('Cleaning', async () => await execa('rimraf', ['./dist']));

const typecheckPlugin = useSpinner<void>('Typechecking', async () => {
  await execa('tsc', ['--noEmit']);
});
const lintPlugin = useSpinner<void>('Linting', async () => {
  const tsLintConfigPath = path.resolve(__dirname, '../../config/tslint.plugin.json');
  const globPattern = path.resolve(process.cwd(), 'src/**/*.+(ts|tsx)');
  const sourcesToLint = glob.sync(globPattern);
  const options = {
    fix: false,
    formatter: 'json',
  };

  const configuration = Configuration.findConfiguration(tsLintConfigPath).results;

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

const testPlugin = useSpinner<void>('Running tests', async () => {
  const testConfig = jestConfig();
  // @ts-ignore

  testConfig.setupFiles = [
    // @ts-ignore
    path.resolve(__dirname, '../../config/jest-setup.js'),
    // @ts-ignore
    path.resolve(__dirname, '../../config/jest-shim.js'),
  ];

  const results = await jestCLI.runCLI(testConfig as any, [process.cwd()]);
  if (results.results.numFailedTests > 0) {
    throw new Error('Tests failed');
  }
});

const bundlePlugin = useSpinner<void>('Bundling plugin', async () => {
  // @ts-ignore
  const bundle = await rollup.rollup(inputOptions());
  // TODO: we can work on more verbose output
  await bundle.generate(outputOptions);
  await bundle.write(outputOptions);
});

const pluginBuildRunner: TaskRunner<PrecommitOptions> = async () => {
  await clean();
  await lintPlugin();
  await testPlugin();
  await bundlePlugin();
};

export const pluginBuildTask = new Task<PrecommitOptions>('Build plugin', pluginBuildRunner);
