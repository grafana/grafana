function runTests(fixture) {
    var results = { passed: [], failed: [] };
    for (var testName in fixture) {
        var test = fixture[testName];
        if (typeof test === "function") {
            try {
                test();
                results.passed.push(testName);
            }
            catch (e) {
                results.failed.push([testName, e]);
            }
        }
    }
    return results;
}
exports.runTests = runTests;
function printResults(results) {
    for (var _i = 0, _a = results.failed; _i < _a.length; _i++) {
        var _b = _a[_i], testName = _b[0], error = _b[1];
        var message_1 = "stack" in error ? error.stack : String(error);
        console.error(testName + " failed.\n" + message_1);
    }
    var passedCount = results.passed.length;
    var failedCount = results.failed.length;
    var totalCount = passedCount + failedCount;
    var message = "Run " + (failedCount > 0 ? "failed" : "succeeded") + ": passed: " + passedCount + ", failed: " + failedCount + ", total: " + totalCount + ".";
    if (results.failed.length) {
        console.error(message);
    }
    else {
        console.log(message);
    }
}
exports.printResults = printResults;
//# sourceMappingURL=harness.js.map