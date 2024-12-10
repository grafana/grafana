'use strict';

const Mocha = require('mocha');
const { EVENT_TEST_END, EVENT_RUN_END, EVENT_TEST_FAIL, EVENT_TEST_PASS } = Mocha.Runner.constants;

class LogReporter extends Mocha.reporters.Spec {
  constructor(runner, options = {}) {
    super(runner, options);

    this._testsResults = [];
    this._testFailures = [];
    this._testPasses = [];

    runner.on(EVENT_TEST_END, (test) => {
      this._testsResults.push(test);
    });

    runner.on(EVENT_TEST_PASS, (test) => {
      this._testPasses.push(test);
    });

    runner.on(EVENT_TEST_FAIL, (test) => {
      this._testFailures.push(test);
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
      // Format time in epoch
      start: this.stats.start.getTime(),
      end: this.stats.end.getTime(),
    };

    // Example
    // CypressStats suites=1 tests=2 testPasses=1 pending=0 failures=1
    // start=1668783563731 end=1668783645198 duration=81467
    console.log(`CypressStats ${objToLogAttributes(stats)}`);
  }

  reportResults() {
    this._testsResults.map(cleanTest).map((test) => {
      // Example
      // CypressTestResult title="Login scenario, create test data source, dashboard, panel, and export scenario"
      // suite="Smoke tests" file=../../e2e/smoke-tests-suite/1-smoketests.spec.ts duration=68694
      // currentRetry=0 speed=undefined err=false
      console.log(`CypressTestResult ${objToLogAttributes(test)}`);
    });
  }

  reportErrors() {
    this._testFailures.map(cleanTest).forEach((failure) => {
      const suite = failure.suite;
      const test = failure.title;
      const error = failure.err;

      // Example
      // CypressError suite="Smoke tests" test="Login scenario, create test data source, dashboard,
      // panel, and export scenario" error=false
      console.error(`CypressError ${objToLogAttributes({ suite, test, error })}`);
    });
  }
}

/**
 * Stringify object to be log friendly
 * @param {Object} obj
 * @returns {String}
 */
function objToLogAttributes(obj) {
  return Object.entries(obj)
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(' ');
}

/**
 * Escape double quotes
 * @param {String} str
 * @returns
 */
function escapeQuotes(str) {
  return String(str).replaceAll('"', '\\"');
}

/**
 * Wrap the value within double quote if needed
 * @param {*} value
 * @returns
 */
function formatValue(value) {
  const hasWhiteSpaces = /\s/g.test(value);

  return hasWhiteSpaces ? `"${escapeQuotes(value)}"` : value;
}

/**
 * Simplify the Mocha test object to get the information we need want to report
 * @param {Mocha.Test} test
 * @returns {Object}
 */
function cleanTest(test) {
  const err = test.err instanceof Error ? test.err.toString() : false;
  const testLocation = getTestLocation(test);
  // Remove the test title
  const suite = testLocation.slice(0, testLocation.length - 1).join(' > ');

  return {
    currentRetry: test.currentRetry(),
    duration: test.duration,
    speed: test.speed,
    file: getTestFile(test),
    suite,
    title: test.title,
    err,
  };
}

/**
 * Get the test path in the suite herarchy
 * @example
 * ['Root Suite in a file', 'Nested suite', 'test title']
 *
 * @param {Mocha.Test} test
 * @returns {Array<String>}
 */
function getTestLocation(test) {
  let path = test.title ? [test.title] : [];

  if (test.parent) {
    path = getTestLocation(test.parent).concat(path);
  }

  return path;
}

/**
 * Get the relative path to the executed spec file
 * @param {Mocha.Test} test
 * @returns {String | null}
 */
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
