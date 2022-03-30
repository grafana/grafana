/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    compareScreenshots(config: CompareScreenshotsConfig | string): Chainable;
    logToConsole(message: string, optional?: any): void;
    readProvisions(filePaths: string[]): Chainable;
    getJSONFilesFromDir(dirPath: string): Chainable;
    startBenchmarking(testName: string): void;
    stopBenchmarking(testName: string, appStats: Record<string, unknown>): void;
  }
}
