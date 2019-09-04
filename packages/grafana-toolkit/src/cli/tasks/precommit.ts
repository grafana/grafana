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

const tasks = {
  test: {
    lint: {
      ts: ['no-only-tests'],
      go: ['no-focus-convey-tests'],
    },
  },
};

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

  const taskPaths = [];

  if (affectedNodeVersionFiles.length > 0) {
    await execTask(nodeVersionCheckerTask)({});
  }

  if (sassFiles.length > 0) {
    taskPaths.push('lint.sass');
  }

  if (testFiles.length) {
    taskPaths.push('test.lint.ts');
  }

  if (goTestFiles.length) {
    taskPaths.push('test.lint.go');
  }

  const gruntTasks = flatten(taskPaths.map(path => get(tasks, path)));
  if (gruntTasks.length > 0) {
    console.log(chalk.yellow(`Precommit checks: ${taskPaths.join(', ')}`));
    const task = execa('grunt', gruntTasks);
    // @ts-ignore
    const stream = task.stdout;
    if (stream) {
      stream.pipe(process.stdout);
    }
    return task;
  }

  console.log(chalk.yellow('Skipping precommit checks, not front-end changes detected'));
  return;
};

export const precommitTask = new Task<PrecommitOptions>('Precommit task', precommitRunner);
