import ora from 'ora';

export const useSpinner = async (label: string, fn: () => Promise<any>, killProcess = true) => {
  const spinner = ora(label);
  spinner.start();
  try {
    await fn();
    spinner.succeed();
  } catch (e) {
    console.trace(e); // eslint-disable-line no-console
    spinner.fail(e.message || e);
    if (killProcess) {
      process.exit(1);
    }
  }
};
