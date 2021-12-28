import ora from 'ora';

export const useSpinner = async (label: string, fn: () => Promise<any>, killProcess = true) => {
  const spinner = ora(label);
  spinner.start();
  try {
    await fn();
    spinner.succeed();
  } catch (err: any) {
    spinner.fail(err.message || err);

    if (err.stdout) {
      console.error(err.stdout);
    } else if (err.message) {
      // Return stack trace if error object
      console.trace(err); // eslint-disable-line no-console
    }

    if (killProcess) {
      process.exit(1);
    }
  }
};
