/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    logToConsole(message: string, optional?: unknown): void;
    readProvisions(filePaths: string[]): Chainable;
    getJSONFilesFromDir(dirPath: string): Chainable;
    startBenchmarking(testName: string): void;
    stopBenchmarking(testName: string, appStats: Record<string, unknown>): void;
    checkHealthRetryable(fn: Function, retryCount: number): Chainable;
    setLocalStorage(key: string, value: string);
  }
}
