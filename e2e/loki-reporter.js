'use strict';

const Mocha = require('mocha');
const { EVENT_TEST_END, EVENT_RUN_END, EVENT_TEST_FAIL, EVENT_TEST_PASS } = Mocha.Runner.constants;

class LogReporter extends Mocha.reporters.Base {
  constructor(runner, options = {}) {
    super(runner, options);

    this.tests = [];
    this.failures = [];
    this.passes = [];

    runner.on(EVENT_TEST_END, (test) => {
      this.tests.push(testToJSON(test));
    });

    runner.on(EVENT_TEST_PASS, (test) => {
      this.passes.push(testToJSON(test));
    });

    runner.on(EVENT_TEST_FAIL, (test) => {
      this.failures.push(testToJSON(test));
    });

    runner.once(EVENT_RUN_END, () => {
      this.reportStats();
      this.reportErrors();
    });
  }

  reportStats() {
    const stats = {
      ...this.stats,
      start: this.stats.start.getTime(),
      end: this.stats.end.getTime(),
    };

    console.log(`CypressStats ${logObj(stats)}`);
  }

  reportResults() {
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
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(' ');
}

function escapeQuotes(str) {
  return String(str).replaceAll('"', '\\"');
}

function formatValue(value) {
  const hasWhiteSpaces = /\s/g.test(value);

  return hasWhiteSpaces ? `"${escapeQuotes(value)}"` : value;
}

function testToJSON(test) {
  let err = test.err || {};

  if (err instanceof Error) {
    err = err.toString();
  }

  return {
    title: test.title,
    suite: getTestLocation(test).join(' > '),
    file: getTestFile(test),
    duration: test.duration,
    currentRetry: test.currentRetry(),
    speed: test.speed,
    err,
  };
}

function getTestLocation(test) {
  let path = test.title ? [test.title] : [];

  if (test.parent) {
    path = getTestLocation(test.parent).concat(path);
  }

  return path;
}

function getTestFile(test) {
  if (test?.file) {
    return test?.file;
  }

  if (test?.parent) {
    return getTestFile(test.parent);
  }

  return null;
}

module.exports = LogReporter;
