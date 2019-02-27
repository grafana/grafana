import { Task } from '..';

export const execTask = async <T>(taskName, options?: T) => {
  const task = await import(`${__dirname}/../tasks/${taskName}.ts`);
  return task.default(options) as Task<T>;
};
