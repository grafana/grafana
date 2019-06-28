import { Task, TaskRunner } from './task';
import chalk from 'chalk';
import semver from 'semver';
import fs from 'fs';

interface FailedVersionCheck {
  file: string;
  line: string;
}

interface NodeVersionCheckerOptions {}

const pattern = /(circleci\/|FROM )node\:([0-9]+(\.[0-9]+){0,2})/gm;
const packageJsonFile = 'package.json';
const circleCiConfigFile = '.circleci/config.yml';
const dockerFile = 'Dockerfile';

export const nodeVersionFiles = [packageJsonFile, circleCiConfigFile, dockerFile];
const nodeVersionFilesToCheck = [circleCiConfigFile, dockerFile];
const failures: FailedVersionCheck[] = [];

const nodeVersionCheckerRunner: TaskRunner<NodeVersionCheckerOptions> = async () => {
  const packageJson = require(`${process.cwd()}/${packageJsonFile}`);
  const expectedVersion = packageJson.engines.node;

  console.log(chalk.yellow(`Specified node version in package.json is: ${expectedVersion}`));

  for (let index = 0; index < nodeVersionFilesToCheck.length; index++) {
    const file = nodeVersionFilesToCheck[index];
    const fileContent = fs.readFileSync(`${process.cwd()}/${file}`);
    const matches = fileContent.toString('utf8').match(pattern);

    for (const match of matches) {
      const actualVersion = semver.coerce(match);
      const satisfies = semver.satisfies(actualVersion, expectedVersion);
      if (!satisfies) {
        failures.push({
          file,
          line: match,
        });
      }
    }
  }

  if (failures.length > 0) {
    console.log(chalk.red('--------------------------------------------------------------------'));
    console.log(chalk.red(`These entries don't satisfy the engine version in ${packageJsonFile}`));
    console.log(chalk.red('--------------------------------------------------------------------'));

    for (let index = 0; index < failures.length; index++) {
      const failure = failures[index];
      console.log(chalk.green(`\tIn ${failure.file} the line ${failure.line} does not satisfy ${expectedVersion}.`));
    }

    throw new Error('Node versions not in sync');
  }

  console.log(chalk.yellow('--------------------------------------------------------------------'));
  console.log(chalk.yellow('All node versions seem ok.'));
  console.log(chalk.yellow("Don't forget to sync https://github.com/grafana/grafana-build-container"));
  console.log(chalk.yellow(`also if you changed the engine version in ${packageJsonFile}`));
  console.log(chalk.yellow('--------------------------------------------------------------------'));
};

export const nodeVersionCheckerTask = new Task<NodeVersionCheckerOptions>();
nodeVersionCheckerTask.setName('Node Version Checker');
nodeVersionCheckerTask.setRunner(nodeVersionCheckerRunner);
