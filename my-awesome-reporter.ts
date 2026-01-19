import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

const grey = (str: string) => `\x1b[2m${str}\x1b[0m`;
const blue = (str: string) => `\x1b[94m${str}\x1b[0m`;
const green = (str: string) => `\x1b[92m${str}\x1b[0m`;

function withDate(...args: any[]) {
  const d = new Date().toISOString();
  return [grey(d), ...args].join(' ');
}

function log(...args) {
  const d = new Date().toISOString();
  console.log(withDate(...args));
}

class MyReporter implements Reporter {
  onBegin(config: FullConfig, suite: Suite) {
    log(`Starting the run with ${suite.allTests().length} tests`);
  }

  onTestBegin(test: TestCase, result: TestResult) {
    log(green('==============================='));
    log(`Starting test ${blue(test.title)}`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    log(`Finished test ${blue(test.title)}: ${result.status}`);
    log(green('==============================='));
  }

  onEnd(result: FullResult) {
    log(`Finished the run: ${result.status}`);
  }

  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    process.stdout.write(`${withDate(blue(`[${test?.title ?? 'log'}]`))} ${chunk}`);
  }

  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    process.stderr.write(`${withDate(blue(`[${test?.title ?? 'log'}]`))} ${chunk}`);
  }
}

export default MyReporter;
