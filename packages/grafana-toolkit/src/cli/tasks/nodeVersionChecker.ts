import { Task, TaskRunner } from './task';
import chalk from 'chalk';
import { coerce, satisfies } from 'semver';
import { readFileSync } from 'fs';

interface FailedVersionCheck {
  file: string;
  line: string;
}

interface NodeVersionCheckerOptions {}

const pattern = /(circleci\/|FROM )node\:([0-9]+(\.[0-9]+){0,2})/gm;
const packageJsonFile = 'package.json';

const failures: FailedVersionCheck[] = [];

export const nodeVersionFiles = [packageJsonFile, 'Dockerfile', '.circleci/config.yml'];

const nodeVersionCheckerRunner: TaskRunner<NodeVersionCheckerOptions> = async () => {
  // Read version from package json and treat that as the expected version in all other locations
  const packageJson = require(`${process.cwd()}/${packageJsonFile}`);
  const expectedVersion = packageJson.engines.node;

  console.log(chalk.yellow(`Specified node version in package.json is: ${expectedVersion}`));

  for (const file of nodeVersionFiles) {
    const fileContent = readFileSync(`${process.cwd()}/${file}`);
    const matches = fileContent.toString('utf8').match(pattern);

    if (!matches) {
      continue;
    }

    for (const match of matches) {
      const actualVersion = coerce(match);
      if (!actualVersion) {
        failures.push({
          file,
          line: match,
        });
        continue;
      }

      const satisfied = satisfies(actualVersion, expectedVersion);
      if (!satisfied) {
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
  console.log(chalk.yellow('--------------------------------------------------------------------'));
};

export const nodeVersionCheckerTask = new Task<NodeVersionCheckerOptions>(
  'Node Version Checker',
  nodeVersionCheckerRunner
);
