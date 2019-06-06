import { Task, TaskRunner } from './task';
// @ts-ignore
import execa = require('execa');
import * as rollup from 'rollup';
import * as jestCLI from 'jest-cli';
import { jestConfig } from '../../config/jest.plugin.config';
import { inputOptions, outputOptions } from '../../config/rollup.plugin.config';
interface PrecommitOptions {}

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

const pluginBuildRunner: TaskRunner<PrecommitOptions> = async () => {
  console.log(process.cwd());
  await testPlugin();
  await lintPlugin();
  // @ts-ignore
  const bundle = await rollup.rollup(inputOptions);

  const { output } = await bundle.generate(outputOptions);
  await bundle.write(outputOptions);
  const task = execa('rollup', ['--config', '']);

  // @ts-ignore
  const stream = task.stdout;
  if (stream) {
    stream.pipe(process.stdout);
  }
  return task;
};

export const pluginBuildTask = new Task<PrecommitOptions>('Build plugin task', pluginBuildRunner);
