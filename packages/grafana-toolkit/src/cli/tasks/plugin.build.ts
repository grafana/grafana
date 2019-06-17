import { Task, TaskRunner } from './task';
// @ts-ignore
import execa = require('execa');
import * as rollup from 'rollup';
import * as jestCLI from 'jest-cli';
import { jestConfig } from '../../config/jest.plugin.config';
import { inputOptions, outputOptions } from '../../config/rollup.plugin.config';
import { useSpinner } from '../utils/useSpinner';
interface PrecommitOptions {}

// @ts-ignore
export const clean = useSpinner<void>('Cleaning', async () => await execa('rimraf', ['./dist']));

const lintPlugin = async () => {
  console.log('Linting with:', `${process.cwd()}/node_modules/@grafana/toolkit/config/tslint.plugin.json`);
  await execa('tslint', [
    '--project',
    `${process.cwd()}/tsconfig.json`,
    '-c',
    `${process.cwd()}/node_modules/@grafana/toolkit/src/config/tslint.plugin.json`,
  ]);
};

const testPlugin = async () => {
  await jestCLI.runCLI(jestConfig as any, [process.cwd()]);
};

const bundlePlugin = async () => {
  // @ts-ignore
  const bundle = await rollup.rollup(inputOptions());
  // TODO: we can work on more verbose output
  await bundle.generate(outputOptions);
  await bundle.write(outputOptions);
};

const pluginBuildRunner: TaskRunner<PrecommitOptions> = async () => {
  await clean();
  // await testPlugin();
  // await lintPlugin();
  await bundlePlugin();
};

export const pluginBuildTask = new Task<PrecommitOptions>('Build plugin task', pluginBuildRunner);
