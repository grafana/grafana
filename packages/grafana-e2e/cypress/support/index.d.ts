/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    compareSnapshot(args: CompareSnapshotArgs): void;
  }
}
