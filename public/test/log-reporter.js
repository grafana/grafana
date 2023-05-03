class LogReporter {
  constructor(globalConfig, reporterOptions, reporterContext) {
    this._globalConfig = globalConfig;
    this._options = reporterOptions;
    this._context = reporterContext;
  }

  onRunComplete(testContexts, results) {
    if (!this._options.enable) {
      return;
    }

    this.logStats(results);
    this.logTestFailures(results);
  }

  logTestFailures(results) {
    results.testResults.forEach(printTestFailures);
  }

  logStats(results) {
    const stats = {
      suites: results.numTotalTestSuites,
      tests: results.numTotalTests,
      passes: results.numPassedTests,
      pending: results.numPendingTests,
      failures: results.numFailedTests,
      duration: Date.now() - results.startTime,
    };
    // JestStats suites=1 tests=94 passes=93 pending=0 failures=1 duration=3973
    console.log(`JestStats ${objToLogAttributes(stats)}`);
  }
}

function printTestFailures(result) {
  if (result.status === 'pending') {
    return;
  }
  if (result.numFailingTests > 0) {
    const testInfo = {
      file: result.testFilePath,
      failures: result.numFailingTests,
      duration: result.perfStats.end - result.perfStats.start,
      errorMessage: result.failureMessage,
    };
    // JestFailure file=<...>/public/app/features/dashboard/state/DashboardMigrator.test.ts
    // failures=1 duration=3251 errorMessage="formatted error message"
    console.log(`JestFailure ${objToLogAttributes(testInfo)}`);
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

module.exports = LogReporter;
