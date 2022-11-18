'use strict';

const Mocha = require('mocha');
const { EVENT_TEST_END, EVENT_RUN_END, EVENT_TEST_FAIL, EVENT_TEST_PASS } = Mocha.Runner.constants;

class LogReporter extends Mocha.reporters.Base {
  constructor(runner, options = {}) {
    super(runner, options);

    this.tests = [];
    this.failures = [];
    this.passes = [];

    runner.on(EVENT_TEST_END, function (test) {
      this.tests.push(testToJSON(test));
    });

    runner.on(EVENT_TEST_PASS, function (test) {
      this.passes.push(testToJSON(test));
    });

    runner.on(EVENT_TEST_FAIL, function (test) {
      console.log(this);
      this.failures.push(testToJSON(test));
    });

    runner.once(EVENT_RUN_END, () => {
      this.reportStats();
      this.reportErrors();
    });
  }

  reportStats() {
    console.log(`CypressStats ${logObj(this.stats)}`);

    this.tests.map((test) => {
      console.log(`CypressTestResult ${logObj(test)}`);
    });
  }

  reportErrors() {
    this.failures.forEach((failure) => {
      const suite = failure.suite;
      const test = failure.title;
      const error = failure.err.message;

      console.error(`CypressError ${logObj({ suite, test, error })}`);
    });
  }
}

function logObj(obj) {
  return Object.entries(obj)
    .map(([key, value]) => `${key}="${escapeQuotes(value)}"`)
    .join(' ');
}

function escapeQuotes(str) {
  return String(str).replaceAll('"', '\\"');
}

function testToJSON(test) {
  let err = test.err || {};

  if (err instanceof Error) {
    err = {
      name: err.name,
      stack: err.stack,
      message: err.message,
    };
  }

  return {
    title: test.title,
    suite: String(test.fullTitle).replace(test.title, '').trim(),
    file: test.file,
    duration: test.duration,
    currentRetry: test.currentRetry(),
    speed: test.speed,
    err,
  };
}

module.exports = LogReporter;
