/// <reference types="cypress" />

interface CompareScreenshotsConfig {
  name: string;
  threshold?: number;
}

declare namespace Cypress {
  interface Chainable {
    compareScreenshots(config: CompareScreenshotsConfig | string): Chainable;
    logToConsole(message: string, optional?: any): void;
    readProvisions(filePaths: string[]): Chainable;
    getJSONFilesFromDir(dirPath: string): Chainable;
    startBenchmarking(testName: string): void;
    stopBenchmarking(testName: string, appStats: Record<string, unknown>): void;
    checkHealthRetryable(fn: Function, retryCount: number): Chainable;
  }
}
