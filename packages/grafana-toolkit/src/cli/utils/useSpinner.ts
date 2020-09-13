import ora = require('ora');

type FnToSpin<T> = (options: T) => Promise<void>;

export const useSpinner = <T = any>(spinnerLabel: string, fn: FnToSpin<T>, killProcess = true) => {
  return async (options: T) => {
    const spinner = ora(spinnerLabel);
    spinner.start();
    try {
      await fn(options);
      spinner.succeed();
    } catch (e) {
      console.trace(e); // eslint-disable-line no-console
      spinner.fail(e.message || e);
      if (killProcess) {
        process.exit(1);
      }
    }
  };
};
