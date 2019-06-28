import { Task, TaskRunner } from './task';
import chalk from 'chalk';
// @ts-ignore
import get from 'lodash/get';
// @ts-ignore
import flatten from 'lodash/flatten';
import execa = require('execa');
const simpleGit = require('simple-git/promise')(process.cwd());

interface PrecommitOptions {}

const tasks = {
  lint: {
    sass: ['newer:sasslint'],
    core: ['newer:exec:tslintRoot'],
    gui: ['newer:exec:tslintPackages'],
  },
  typecheck: {
    core: ['newer:exec:typecheckRoot'],
    gui: ['newer:exec:typecheckPackages'],
  },
  test: {
    lint: {
      ts: ['no-only-tests'],
      go: ['no-focus-convey-tests'],
    },
  },
};

const precommitRunner: TaskRunner<PrecommitOptions> = async () => {
  const status = await simpleGit.status();
  const sassFiles = status.files.filter(
    (file: any) =>
      (file.path as string).match(/^[a-zA-Z0-9\_\-\/]+(\.scss)$/g) || file.path.indexOf('.sass-lint.yml') > -1
  );

  const tsFiles = status.files.filter((file: any) => (file.path as string).match(/^[a-zA-Z0-9\_\-\/]+(\.(ts|tsx))$/g));
  const testFiles = status.files.filter((file: any) =>
    (file.path as string).match(/^[a-zA-Z0-9\_\-\/]+(\.test.(ts|tsx))$/g)
  );
  const goTestFiles = status.files.filter((file: any) =>
    (file.path as string).match(/^[a-zA-Z0-9\_\-\/]+(\_test.go)$/g)
  );
  const grafanaUiFiles = tsFiles.filter((file: any) => (file.path as string).indexOf('grafana-ui') > -1);

  const grafanaUIFilesChangedOnly = tsFiles.length > 0 && tsFiles.length - grafanaUiFiles.length === 0;
  const coreFilesChangedOnly = tsFiles.length > 0 && grafanaUiFiles.length === 0;

  const taskPaths = [];

  if (sassFiles.length > 0) {
    taskPaths.push('lint.sass');
  }

  if (testFiles.length) {
    taskPaths.push('test.lint.ts');
  }

  if (goTestFiles.length) {
    taskPaths.push('test.lint.go');
  }

  if (tsFiles.length > 0) {
    if (grafanaUIFilesChangedOnly) {
      taskPaths.push('lint.gui', 'typecheck.core', 'typecheck.gui');
    } else if (coreFilesChangedOnly) {
      taskPaths.push('lint.core', 'typecheck.core');
    } else {
      taskPaths.push('lint.core', 'lint.gui', 'typecheck.core', 'typecheck.gui');
    }
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
