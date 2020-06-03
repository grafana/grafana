/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    compareScreenshots(config: CompareScreenshotsConfig | string): Chainable;
    logToConsole(message: string, optional?: any): void;
    readProvisions(filePaths: string[]): Chainable;
  }
}
