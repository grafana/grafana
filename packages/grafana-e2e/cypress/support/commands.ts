// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This is will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

// Must be declared global to be detected by typescript (allows import/export)
// eslint-disable @typescript/interface-name

interface CompareSnapshotArgs {
  pathToFileA: string;
  pathToFileB: string;
  threshold?: number;
}
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable<Subject> {
      compareSnapshot(args: CompareSnapshotArgs): void;
    }
  }
}

Cypress.Commands.add('compareSnapshot', (args: CompareSnapshotArgs) => {
  cy.task('compareSnapshotsPlugin', args).then((results: any) => {
    if (results.code <= 1) {
      let msg = `\nThe screenshot:[${args.pathToFileA}] differs from :[${args.pathToFileB}]`;
      msg += '\n';
      msg += '\nCheck the Artifacts tab in the CircleCi build output for the actual screenshots.';
      msg += '\n';
      msg += '\n  If the difference between expected and outcome is NOT acceptable then do the following:';
      msg += '\n    - Check the code for changes that causes this difference, fix that and retry.';
      msg += '\n';
      msg += '\n  If the difference between expected and outcome is acceptable then do the following:';
      msg += '\n    - Replace the expected image with the outcome and retry.';
      msg += '\n';
      throw new Error(msg);
    }
  });
});

// Convert this to a module instead of script (allows import/export)
export {};
