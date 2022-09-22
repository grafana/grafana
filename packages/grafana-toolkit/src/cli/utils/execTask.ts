/* eslint-disable no-console */
import chalk from 'chalk';

import { Task } from '../tasks/task';

interface TaskBasicOptions {
  // Don't print task details when running
  silent?: boolean;
}

export const execTask =
  <TOptions>(task: Task<TOptions>) =>
  async (options: TOptions & TaskBasicOptions) => {
    if (!options.silent) {
      console.log(chalk.yellow(`Running ${chalk.bold(task.name)} task`));
    }
    task.setOptions(options);
    try {
      console.group();
      await task.exec();
      console.groupEnd();
    } catch (e) {
      console.trace(e);
      process.exit(1);
    }
  };
