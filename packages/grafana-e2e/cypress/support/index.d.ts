/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    compareSnapshot(args: CompareSnapshotArgs): void;
    logToConsole(message: string, optional?: any): void;
  }
}
