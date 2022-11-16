'use strict';

const Mocha = require('mocha');
const { EVENT_RUN_BEGIN, EVENT_RUN_END, EVENT_TEST_FAIL, EVENT_TEST_PASS, EVENT_SUITE_BEGIN, EVENT_SUITE_END } =
  Mocha.Runner.constants;
const JsonReporter = Mocha.reporters.JSON;

// this reporter outputs test results, indenting two spaces per suite
class MyReporter extends Mocha.reporters.JSON {
  constructor(runner) {
    super(runner);

    runner.once(EVENT_RUN_END, () => {
      console.log('\n---- LOKI REPORTER ----\n');
      console.log(runner.testResults);
      runner.testResults.failures.forEach((failure) => {
        const timestamp = Date.now();
        const suiteName = String(failure.fullTitle).replace(failure.title, '').trim();
        const testName = failure.title;
        const errorMessage = failure.err.message;
        console.error(`{timestamp=${timestamp}} {suite=${suiteName}} {test=${testName}} {error=${errorMessage}}`);
      });
    });
  }
}

module.exports = MyReporter;
