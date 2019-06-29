import { Task, TaskRunner } from './task';
// @ts-ignore
import execa = require('execa');
import path = require('path');
import fs = require('fs');
import glob = require('glob');
import * as rollup from 'rollup';
import { inputOptions, outputOptions } from '../../config/rollup.plugin.config';

import { useSpinner } from '../utils/useSpinner';
import { Linter, Configuration, RuleFailure } from 'tslint';
import { testPlugin } from './plugin/tests';
interface PrecommitOptions {}

// @ts-ignore
export const clean = useSpinner<void>('Cleaning', async () => await execa('rimraf', ['./dist']));

// @ts-ignore
const typecheckPlugin = useSpinner<void>('Typechecking', async () => {
  await execa('tsc', ['--noEmit']);
});

// @ts-ignore
const lintPlugin = useSpinner<void>('Linting', async () => {
  let tsLintConfigPath = path.resolve(process.cwd(), 'tslint.json');
  if (!fs.existsSync(tsLintConfigPath)) {
    tsLintConfigPath = path.resolve(__dirname, '../../config/tslint.plugin.json');
  }
  const globPattern = path.resolve(process.cwd(), 'src/**/*.+(ts|tsx)');
  const sourcesToLint = glob.sync(globPattern);
  const options = {
    fix: true, // or fail
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

const bundlePlugin = useSpinner<void>('Bundling plugin', async () => {
  // @ts-ignore
  const bundle = await rollup.rollup(inputOptions());
  // TODO: we can work on more verbose output
  await bundle.generate(outputOptions);
  await bundle.write(outputOptions);
});

const pluginBuildRunner: TaskRunner<PrecommitOptions> = async () => {
  await clean();
  // @ts-ignore
  await lintPlugin();
  await testPlugin({ updateSnapshot: false, coverage: false });
  // @ts-ignore
  await bundlePlugin();
};

export const pluginBuildTask = new Task<PrecommitOptions>('Build plugin', pluginBuildRunner);
