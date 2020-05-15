import { Task, TaskRunner } from './task';
import chalk from 'chalk';
// @ts-ignore
import get from 'lodash/get';
// @ts-ignore
import flatten from 'lodash/flatten';
import execa = require('execa');
import { nodeVersionCheckerTask, nodeVersionFiles } from './nodeVersionChecker';
import { execTask } from '../utils/execTask';
const simpleGit = require('simple-git/promise')(process.cwd());

interface PrecommitOptions {}

interface GitStatus {
  files: GitFile[];
}

interface GitFile {
  path: string;
}

const precommitRunner: TaskRunner<PrecommitOptions> = async () => {
  const status: GitStatus = await simpleGit.status();
  const sassFiles = status.files.filter(
    file => file.path.match(/^[a-zA-Z0-9\_\-\/]+(\.scss)$/g) || file.path.indexOf('.sass-lint.yml') > -1
  );

  const testFiles = status.files.filter(file => file.path.match(/^[a-zA-Z0-9\_\-\/]+(\.test.(ts|tsx))$/g));
  const goTestFiles = status.files.filter(file => file.path.match(/^[a-zA-Z0-9\_\-\/]+(\_test.go)$/g));
  const affectedNodeVersionFiles = status.files
    .filter(file => nodeVersionFiles.indexOf(file.path) !== -1)
    .map(f => f.path);

  const gruntTasks = [];

  if (affectedNodeVersionFiles.length > 0) {
    await execTask(nodeVersionCheckerTask)({});
  }

  if (sassFiles.length > 0) {
    gruntTasks.push('sasslint');
  }

  if (testFiles.length) {
    gruntTasks.push('no-only-tests');
  }

  if (goTestFiles.length) {
    gruntTasks.push('no-focus-convey-tests');
  }

  if (gruntTasks.length > 0) {
    console.log(chalk.yellow(`Precommit checks: ${gruntTasks.join(', ')}`));
    const task = execa('grunt', gruntTasks);
    // @ts-ignore
    const stream = task.stdout;
    if (stream) {
      stream.pipe(process.stdout);
    }
    return task;
  }

  console.log(chalk.yellow('Skipping precommit checks, no front-end changes detected'));
  return undefined;
};

export const precommitTask = new Task<PrecommitOptions>('Precommit task', precommitRunner);
