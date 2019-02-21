import ora from 'ora';

export const startSpinner = (label: string) => {
  const spinner = new ora(label);
  spinner.start();
  return spinner;
};
