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
      this.tests.push(cleanTest(test));
    });

    runner.on(EVENT_TEST_PASS, (test) => {
      this.passes.push(cleanTest(test));
    });

    runner.on(EVENT_TEST_FAIL, (test) => {
      this.failures.push(cleanTest(test));
    });

    runner.once(EVENT_RUN_END, () => {
      this.reportStats();
      this.reportResults();
      this.reportErrors();
    });
  }

  reportStats() {
    const stats = {
      ...this.stats,
      start: this.stats.start.getTime(),
      end: this.stats.end.getTime(),
    };

    // Example
    // suites=1 tests=2 passes=1 pending=0 failures=1 start=1668783563731 end=1668783645198 duration=81467
    console.log(`CypressStats ${logObj(stats)}`);
  }

  reportResults() {
    this.tests.map((test) => {
      // Example
      // CypressTestResult title="Login scenario, create test data source, dashboard, panel, and export scenario"
      // suite="Smoke tests > Login scenario, create test data source, dashboard, panel, and export scenario"
      // file=../../e2e/smoke-tests-suite/1-smoketests.spec.ts duration=68694 currentRetry=0 speed=undefined
      // err=false
      console.log(`CypressTestResult ${logObj(test)}`);
    });
  }

  reportErrors() {
    this.failures.forEach((failure) => {
      const suite = failure.suite;
      const test = failure.title;
      const error = failure.err;

      // Example
      // CypressError suite="Smoke tests > Login scenario, create test data source, dashboard,
      // panel, and export scenario" test="Login scenario, create test data source, dashboard,
      // panel, and export scenario" error=false
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

function cleanTest(test) {
  const err = test.err instanceof Error ? test.err.toString() : false;

  return {
    currentRetry: test.currentRetry(),
    duration: test.duration,
    speed: test.speed,
    file: getTestFile(test),
    suite: getTestLocation(test).join(' > '),
    title: test.title,
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
