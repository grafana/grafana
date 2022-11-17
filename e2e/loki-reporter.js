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
      this.reportStats(runner);
      this.reportErrors(runner);
    });
  }

  reportStats(runner) {
    console.log(`CypressStats ${this.strigifyObj(runner.testResults.stats)}`);
  }

  reportErrors(runner) {
    runner.testResults.failures.forEach((failure) => {
      const suite = String(failure.fullTitle).replace(failure.title, '').trim();
      const test = failure.title;
      const error = failure.err.message;

      console.error(`CypressError ${this.strigifyObj({ suite, test, error })}`);
    });
  }

  strigifyObj(obj) {
    return Object.entries(obj).map(([key, value]) => `${key}="${this.escapeValue(value)}"`);
  }

  escapeValue(str) {
    return String(str).replace('"', '\\"');
  }
}

module.exports = MyReporter;
