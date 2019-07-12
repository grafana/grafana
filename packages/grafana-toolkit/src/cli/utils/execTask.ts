import { Task } from '../tasks/task';
import chalk from 'chalk';

export const execTask = <TOptions>(task: Task<TOptions>) => async (options: TOptions) => {
  console.log(chalk.yellow(`Running ${chalk.bold(task.name)} task`));
  task.setOptions(options);
  try {
    console.group();
    await task.exec();
    console.groupEnd();
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
};
