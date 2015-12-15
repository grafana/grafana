export interface TestResults {
    passed: string[];
    failed: [string, any][];
}

export function runTests(fixture: any): TestResults {
    let results: TestResults = { passed: [], failed: [] };
    for (let testName in fixture) {
        let test = fixture[testName];
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

export function printResults(results: TestResults): void {
    for (let [testName, error] of results.failed) {
        let message = "stack" in error ? error.stack : String(error);
        console.error(`${testName} failed.\n${message}`);
    }

    let passedCount = results.passed.length;
    let failedCount = results.failed.length;
    let totalCount = passedCount + failedCount;

    let message = `Run ${failedCount > 0 ? "failed" : "succeeded" }: passed: ${passedCount}, failed: ${failedCount}, total: ${totalCount}.`;
    if (results.failed.length) {
        console.error(message);
    }
    else {
        console.log(message);
    }
}